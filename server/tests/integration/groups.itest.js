// Group mode end to end: create, join by code, lost card, meeting points, live location, permissions.
const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { app, request, startDb, stopDb, register, auth } = require('./setup');

let leader;
let member;
let outsider;
let group;
let tripId;

before(async () => {
  const hotels = await startDb();
  leader = await register('leader@test.dev', 'Bilal');
  member = await register('member@test.dev', 'Ahmed');
  outsider = await register('outsider@test.dev', 'Zaid');

  // The leader's trip: Makkah today and for the next days, so the card shows a Makkah hotel.
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const makkah = hotels.find((h) => h.name === 'Swissotel Makkah');
  const trip = await request(app)
    .post('/api/trips')
    .set(auth(leader))
    .send({
      people: 2,
      stays: [
        { city: 'Makkah', hotelId: makkah._id, checkIn: iso(new Date(today.getTime() - 86400000)), checkOut: iso(new Date(today.getTime() + 5 * 86400000)) },
      ],
    });
  tripId = trip.body._id;
});

after(stopDb);

describe('group mode', () => {
  test('leader creates a group linked to a trip', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(auth(leader))
      .send({ name: 'Family Umrah', leaderPhone: '+966 50 123 4567', tripId });
    expect(res.status).toBe(201);
    group = res.body;
    expect(group.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(group.isLeader).toBe(true);
    expect(group.hotel).toMatchObject({ name: 'Swissotel Makkah', nameAr: 'فندق سويس أوتيل مكة', city: 'Makkah' });
    expect(group.myCard.leader.phone).toBe('+966 50 123 4567');
  });

  test("can't link someone else's trip or use a bad phone", async () => {
    expect((await request(app).post('/api/groups').set(auth(member)).send({ name: 'X', tripId })).status).toBe(400);
    expect((await request(app).post('/api/groups').set(auth(member)).send({ name: 'X', leaderPhone: 'abc' })).status).toBe(400);
  });

  test('member joins with the code (case and dashes ignored)', async () => {
    const typed = `${group.code.slice(0, 3).toLowerCase()}-${group.code.slice(3)}`;
    const res = await request(app).post('/api/groups/join').set(auth(member)).send({ code: typed, phone: '0300 1234567' });
    expect(res.status).toBe(201);
    expect(res.body.isLeader).toBe(false);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.tripId).toBeUndefined();
    expect(res.body.myCard).toMatchObject({ name: 'Ahmed', groupName: 'Family Umrah', hotel: { city: 'Makkah' } });

    const again = await request(app).post('/api/groups/join').set(auth(member)).send({ code: group.code });
    expect(again.body.members).toHaveLength(2);
    expect((await request(app).post('/api/groups/join').set(auth(member)).send({ code: 'ZZZZZZ' })).status).toBe(404);
  });

  test('only the leader manages meeting points', async () => {
    const url = `/api/groups/${group._id}/meeting-points`;
    const soon = new Date(Date.now() + 3600000).toISOString();
    expect((await request(app).post(url).set(auth(member)).send({ title: 'x', place: 'y' })).status).toBe(403);
    const res = await request(app).post(url).set(auth(leader)).send({ title: 'After Isha', place: 'Gate 79 (King Fahd)', time: soon });
    expect(res.status).toBe(201);
    expect(res.body.meetingPoints[0].place).toBe('Gate 79 (King Fahd)');
    expect(res.body.myCard.meetingPoint.place).toBe('Gate 79 (King Fahd)');
  });

  test('live location: opt-in, visible to the group, can be stopped', async () => {
    const url = `/api/groups/${group._id}/location`;
    expect((await request(app).put(url).set(auth(member)).send({ lat: 21.4225, lng: 39.8262 })).status).toBe(409);
    expect((await request(app).put(url).set(auth(member)).send({ lat: 21.4225, lng: 39.8262, minutes: 999 })).status).toBe(400);
    const start = await request(app).put(url).set(auth(member)).send({ lat: 21.4225, lng: 39.8262, accuracy: 15, minutes: 30 });
    expect(start.status).toBe(200);

    const seen = await request(app).get(`/api/groups/${group._id}`).set(auth(leader));
    const ahmed = seen.body.members.find((m) => m.displayName === 'Ahmed');
    expect(ahmed.location).toMatchObject({ lat: 21.4225, lng: 39.8262, accuracy: 15, stale: false });

    await request(app).delete(url).set(auth(member));
    const after = await request(app).get(`/api/groups/${group._id}`).set(auth(leader));
    expect(after.body.members.find((m) => m.displayName === 'Ahmed').location).toBe(null);
  });

  test('public lost card from the QR token: no location, no join code', async () => {
    const mine = await request(app).get(`/api/groups/${group._id}`).set(auth(member));
    const res = await request(app).get(`/api/lost/${mine.body.myCard.cardToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Ahmed', phone: '0300 1234567', leader: { name: 'Bilal' }, hotel: { nameAr: 'فندق سويس أوتيل مكة' } });
    expect(res.body.cardToken).toBeUndefined();
    expect(res.body.code).toBeUndefined();
    expect((await request(app).get('/api/lost/0000')).status).toBe(404);
  });

  test("outsiders can't see the group; members can't remove others", async () => {
    expect((await request(app).get(`/api/groups/${group._id}`).set(auth(outsider))).status).toBe(404);
    const g = await request(app).get(`/api/groups/${group._id}`).set(auth(member));
    const leaderMember = g.body.members.find((m) => m.role === 'leader');
    expect((await request(app).delete(`/api/groups/${group._id}/members/${leaderMember._id}`).set(auth(member))).status).toBe(403);
  });

  test('new code invalidates the old one; member leaves; leader deletes', async () => {
    const old = group.code;
    const { code } = (await request(app).post(`/api/groups/${group._id}/code`).set(auth(leader))).body;
    expect(code === old).toBe(false);
    expect((await request(app).post('/api/groups/join').set(auth(outsider)).send({ code: old })).status).toBe(404);

    const g = await request(app).get(`/api/groups/${group._id}`).set(auth(member));
    const me = g.body.members.find((m) => m.isMe);
    expect((await request(app).delete(`/api/groups/${group._id}/members/${me._id}`).set(auth(member))).status).toBe(204);
    expect((await request(app).get('/api/groups').set(auth(member))).body).toHaveLength(0);

    expect((await request(app).delete(`/api/groups/${group._id}`).set(auth(leader))).status).toBe(204);
  });
});
