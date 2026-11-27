// Shared setup for integration tests: a temporary MongoDB, the seeded hotels and small request helpers.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const app = require('../../src/app');
const Hotel = require('../../src/models/Hotel');
const hotelsData = require('../../src/data/hotels');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Unique keys (notification log, assistant quota) must exist before the first write.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  return Hotel.insertMany(hotelsData);
}

async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = undefined;
}

async function register(email, name = 'Tester') {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'secret1' });
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, mongoose, startDb, stopDb, register, auth };
