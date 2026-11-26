// Cron delivery: rejected without the secret, sent once, and a dead subscription is removed.
const { describe, test, before, after } = require('node:test');
const webpush = require('web-push');
const { expect } = require('./expect');
const { app, request, startDb, stopDb, register, auth } = require('./setup');
const PushSubscription = require('../../src/models/PushSubscription');
const pushTransport = require('../../src/services/pushTransport');

const originalSend = pushTransport.sendNotification;
const calls = [];
const ENDPOINT = 'https://push.example.test/device-1';

function allowSend() {
  pushTransport.sendNotification = async (sub, payload, options) => {
    calls.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), options });
  };
}

before(async () => {
  await startDb();
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  process.env.CRON_SECRET = 'cron-test-secret';
  allowSend();
});

after(async () => {
  pushTransport.sendNotification = originalSend;
  await stopDb();
});

describe('notification cron', () => {
  test('returns 401 without the cron secret', async () => {
    expect((await request(app).post('/api/cron/notifications')).status).toBe(401);
    const wrong = await request(app).post('/api/cron/notifications').set('Authorization', 'Bearer wrong-secret');
    expect(wrong.status).toBe(401);
  });

  test('sends a meeting reminder once, then skips it', async () => {
    const token = await register('push@test.dev', 'Huda');
    await request(app).post('/api/notifications/subscribe').set(auth(token)).send({
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
    const group = await request(app).post('/api/groups').set(auth(token)).send({ name: 'Family' });
    const when = new Date(Date.now() + 4 * 60 * 1000).toISOString();
    const added = await request(app)
      .post(`/api/groups/${group.body._id}/meeting-points`)
      .set(auth(token))
      .send({ title: 'After Isha', place: 'Gate 79 (King Fahd Gate)', time: when, note: 'Bring water' });
    expect(added.status).toBe(201);

    calls.length = 0;
    const first = await request(app).post('/api/cron/notifications').set('Authorization', 'Bearer cron-test-secret');
    expect(first.status).toBe(200);
    expect(first.body.sent).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].endpoint).toBe(ENDPOINT);
    expect(calls[0].payload.title).toBe('Meeting in 5 minutes');
    expect(calls[0].payload.body).toMatch(/After Isha at Gate 79 \(King Fahd Gate\)/);
    expect(calls[0].payload.icon).toBe('/icon-192.png');
    expect(calls[0].options).toMatchObject({ TTL: 600, urgency: 'high' });

    const second = await request(app).post('/api/cron/notifications').set('Authorization', 'Bearer cron-test-secret');
    expect(second.status).toBe(200);
    expect(second.body.sent).toBe(0);
    expect(second.body.skipped).toBe(1);
    expect(calls).toHaveLength(1);
  });

  test('deletes a subscription when the push service returns 410', async () => {
    const token = await register('gone@test.dev', 'Sami');
    const endpoint = 'https://push.example.test/device-gone';
    await request(app).post('/api/notifications/subscribe').set(auth(token)).send({
      endpoint,
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
    const group = await request(app).post('/api/groups').set(auth(token)).send({ name: 'Brothers' });
    const when = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    await request(app)
      .post(`/api/groups/${group.body._id}/meeting-points`)
      .set(auth(token))
      .send({ title: 'After Fajr', place: 'Gate 1', time: when });

    pushTransport.sendNotification = async () => {
      const err = new Error('gone');
      err.statusCode = 410;
      throw err;
    };
    const res = await request(app).post('/api/cron/notifications').set('Authorization', 'Bearer cron-test-secret');
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
    expect(await PushSubscription.countDocuments({ endpoint })).toBe(0);
    allowSend();
  });
});
