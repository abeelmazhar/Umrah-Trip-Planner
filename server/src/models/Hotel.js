const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    addressAr: { type: String, trim: true },
    city: { type: String, enum: ['Makkah', 'Madinah'], required: true },
    distanceToHaramM: { type: Number, required: true, min: 0 },
    pricePerNightSAR: { type: Number, required: true, min: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hotel', hotelSchema);
