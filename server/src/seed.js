require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Hotel = require('./models/Hotel');
const hotels = require('./data/hotels');

// Upserts by hotel name, so it is safe to re-run: existing hotel ids (used by saved trips) are kept.
(async () => {
  try {
    await connectDB();
    const result = await Hotel.bulkWrite(
      hotels.map((h) => ({ updateOne: { filter: { name: h.name }, update: { $set: h }, upsert: true } }))
    );
    console.log(`Hotels: ${result.upsertedCount} added, ${result.modifiedCount} updated.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
