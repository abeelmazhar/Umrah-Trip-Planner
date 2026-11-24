// End-to-end API tests against a temporary in-memory MongoDB.
process.env.JWT_SECRET = 'test-secret';
const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const app = require('../../src/app');
const Hotel = require('../../src/models/Hotel');
const Trip = require('../../src/models/Trip');
const hotelsData = require('../../src/data/hotels');


let mongod;
let token;
let other;
let makkahHotel;
let madinahHotel;

const register = async (email) =>
  (await request(app).post('/api/auth/register').send({ name: 'T', email, password: 'secret1' })).body.token;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const tripBody = () => ({
  people: 3,
  originRegion: 'south-asia',
  homeCurrency: 'PKR',
  stays: [
    { city: 'Madinah', hotelId: madinahHotel._id, checkIn: '2027-01-10', checkOut: '2027-01-13' },
    { city: 'Makkah', hotelId: makkahHotel._id, checkIn: '2027-01-13', checkOut: '2027-01-18' },
  ],
  transferModes: ['train'],
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const hotels = await Hotel.insertMany(hotelsData);
  makkahHotel = hotels.find((h) => h.city === 'Makkah');
  madinahHotel = hotels.find((h) => h.city === 'Madinah');
  token = await register('a@test.dev');
  other = await register('b@test.dev');
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('multi-city trips', () => {
  let trip;

  test('quote prices both stays, the train and VAT, and suggests the miqat', async () => {
    const res = await request(app).post('/api/trips/quote').set(auth(token)).send(tripBody());
    expect(res.status).toBe(200);
    const hotels = 3 * madinahHotel.pricePerNightSAR * 2 + 5 * makkahHotel.pricePerNightSAR * 2;
    expect(res.body.accommodationSubtotalSAR).toBe(hotels);
    expect(res.body.transportSAR).toBe(480);
    expect(res.body.totalCostSAR).toBeCloseTo(hotels * 1.15 + 480, 2);
    expect(res.body.miqat.code).toBe('dhulHulayfah');
  });

  test('create returns the trip with insights', async () => {
    const res = await request(app).post('/api/trips').set(auth(token)).send(tripBody());
    expect(res.status).toBe(201);
    trip = res.body;
    expect(trip.stays).toHaveLength(2);
    expect(trip.stays[0].hotelId.name).toBe(madinahHotel.name);
    expect(trip.transfers[0]).toMatchObject({ from: 'Madinah', to: 'Makkah', mode: 'train' });
    expect(trip.insights.route).toEqual(['Madinah', 'Makkah']);
    expect(trip.insights.homeCurrency.code).toBe('PKR');
    expect(trip.insights.documents.issues[0].code).toBe('missingTravellers');
    expect(trip.checklist.length).toBeGreaterThan(5);
  });

  test('rejects a hotel in the wrong city and a missing transfer choice', async () => {
    const wrong = tripBody();
    wrong.stays[0].hotelId = makkahHotel._id;
    expect((await request(app).post('/api/trips').set(auth(token)).send(wrong)).status).toBe(400);
    const noMode = { ...tripBody(), transferModes: [] };
    expect((await request(app).post('/api/trips').set(auth(token)).send(noMode)).status).toBe(400);
  });

  test('travellers with a short passport are flagged', async () => {
    const res = await request(app)
      .patch(`/api/trips/${trip._id}`)
      .set(auth(token))
      .send({
        travellers: [
          { name: 'Ahmed', gender: 'male', passportExpiry: '2027-03-01', meningitisVaccine: true },
          { name: 'Fatima', gender: 'female', passportExpiry: '2030-01-01', meningitisVaccine: false },
          { name: 'Ali', gender: 'male', passportExpiry: '2030-01-01', meningitisVaccine: true },
        ],
      });
    expect(res.status).toBe(200);
    const codes = res.body.insights.documents.issues.map((i) => `${i.traveller}:${i.code}`);
    expect(codes).toEqual(['0:passportUnder6Months', '1:vaccineMissing']);
    expect(res.body.insights.documents.ok).toBe(false);
  });

  test('budget and expenses: spent vs planned', async () => {
    await request(app)
      .patch(`/api/trips/${trip._id}`)
      .set(auth(token))
      .send({ budget: { foodPerPersonPerDaySAR: 50 } });
    const add = await request(app)
      .post(`/api/trips/${trip._id}/expenses`)
      .set(auth(token))
      .send({ category: 'food', amountSAR: 120.5, note: 'Al Baik' });
    expect(add.status).toBe(201);
    const food = add.body.insights.spending.categories.find((c) => c.category === 'food');
    expect(food).toMatchObject({ plannedSAR: 50 * 3 * 9, spentSAR: 120.5 });

    const expenseId = add.body.expenses[0]._id;
    const del = await request(app).delete(`/api/trips/${trip._id}/expenses/${expenseId}`).set(auth(token));
    expect(del.body.expenses).toHaveLength(0);

    const bad = await request(app).post(`/api/trips/${trip._id}/expenses`).set(auth(token)).send({ category: 'food', amountSAR: -1 });
    expect(bad.status).toBe(400);
  });

  test('ritual companion enforces the order of the rites', async () => {
    const url = `/api/trips/${trip._id}/ritual`;
    expect((await request(app).patch(url).set(auth(token)).send({ saiRounds: 1 })).status).toBe(400);
    await request(app).patch(url).set(auth(token)).send({ ihram: true, tawafRounds: 7 });
    await request(app).patch(url).set(auth(token)).send({ saiRounds: 7 });
    expect((await request(app).patch(url).set(auth(token)).send({ action: 'complete' })).status).toBe(400);
    await request(app).patch(url).set(auth(token)).send({ halq: true });
    const done = await request(app).patch(url).set(auth(token)).send({ action: 'complete' });
    expect(done.body).toMatchObject({ completedUmrahs: 1, tawafRounds: 0, saiRounds: 0, ihram: false });
  });

  test('share link exposes the itinerary only, and can be revoked', async () => {
    const { shareToken } = (await request(app).post(`/api/trips/${trip._id}/share`).set(auth(token))).body;
    expect(shareToken).toMatch(/^[a-f0-9]{32}$/);
    const pub = await request(app).get(`/api/share/${shareToken}`);
    expect(pub.status).toBe(200);
    expect(pub.body.stays[1].hotel.name).toBe(makkahHotel.name);
    expect(pub.body.travellers).toBeUndefined();
    expect(pub.body.expenses).toBeUndefined();
    expect(pub.body.budget).toBeUndefined();

    await request(app).delete(`/api/trips/${trip._id}/share`).set(auth(token));
    expect((await request(app).get(`/api/share/${shareToken}`)).status).toBe(404);
  });

  test("other users can't read or change the trip", async () => {
    expect((await request(app).get(`/api/trips/${trip._id}`).set(auth(other))).status).toBe(404);
    expect((await request(app).post(`/api/trips/${trip._id}/expenses`).set(auth(other)).send({ category: 'food', amountSAR: 1 })).status).toBe(404);
  });

  test('legacy single-hotel trips are upgraded on read', async () => {
    const userId = (await request(app).get('/api/auth/me').set(auth(token))).body.user._id;
    const legacy = await Trip.collection.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      city: 'Makkah',
      startDate: new Date('2027-02-01'),
      endDate: new Date('2027-02-03'),
      people: 2,
      hotelId: makkahHotel._id,
      totalCostSAR: 2 * makkahHotel.pricePerNightSAR * 1.15,
      checklist: [],
    });
    const res = await request(app).get(`/api/trips/${legacy.insertedId}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.stays).toHaveLength(1);
    expect(res.body.stays[0]).toMatchObject({ city: 'Makkah', nights: 2 });
    expect(res.body.insights.miqat.code).toBe('yalamlam');
  });

  test('delete', async () => {
    expect((await request(app).delete(`/api/trips/${trip._id}`).set(auth(token))).status).toBe(204);
  });
});

describe('public planning endpoints', () => {
  test('prayer times for several days', async () => {
    const res = await request(app).get('/api/prayer-times?city=Makkah&date=2026-11-24&days=3');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].times.maghrib).toMatch(/^17:3\d$/);
  });

  test('best times, miqat and meta', async () => {
    expect((await request(app).get('/api/best-times?city=Madinah&date=2026-11-24')).body[0].best).toBe('morning');
    expect((await request(app).get('/api/miqat?origin=gulf-east&firstCity=Makkah')).body.code).toBe('qarnAlManazil');
    const meta = (await request(app).get('/api/meta')).body;
    expect(meta.currencies.USD).toBeCloseTo(0.2667, 3);
    expect(Object.keys(meta.transport)).toEqual(['train', 'bus', 'taxi']);
  });

  test('validates input', async () => {
    expect((await request(app).get('/api/prayer-times?city=Makkah&date=bad')).status).toBe(400);
    expect((await request(app).get('/api/prayer-times?city=Makkah&date=2026-11-24&days=99')).status).toBe(400);
  });
});
