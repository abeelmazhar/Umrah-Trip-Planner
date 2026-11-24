// HTTP-level tests for routes that do not need a database.
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../src/app');

describe('GET /api/crowd', () => {
  test('returns the level for a date and prayer', async () => {
    const res = await request(app).get('/api/crowd?date=2026-11-24&prayer=maghrib');
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('High');
  });

  test('returns a per-prayer breakdown when prayer is omitted', async () => {
    const res = await request(app).get('/api/crowd?date=2026-11-28');
    expect(res.status).toBe(200);
    expect(res.body.prayers).toEqual({
      fajr: 'Medium',
      dhuhr: 'Medium',
      asr: 'Low',
      maghrib: 'High',
      isha: 'High',
    });
  });

  test('400 without a date', async () => {
    const res = await request(app).get('/api/crowd');
    expect(res.status).toBe(400);
  });

  test('400 for an unknown prayer', async () => {
    const res = await request(app).get('/api/crowd?date=2026-11-24&prayer=xyz');
    expect(res.status).toBe(400);
  });
});

describe('auth middleware', () => {
  test('trip routes require a token', async () => {
    const res = await request(app).get('/api/trips');
    expect(res.status).toBe(401);
  });

  test('rejects an invalid token', async () => {
    const res = await request(app).get('/api/trips').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });
});
