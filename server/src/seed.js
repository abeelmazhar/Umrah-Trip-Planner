require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Hotel = require('./models/Hotel');
const hotels = require('./data/hotels');

(async () => {
  try {
    await connectDB();
    await Hotel.deleteMany({});
    const created = await Hotel.insertMany(hotels);
    console.log(`Seeded ${created.length} hotels.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
