const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
});

const tripSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    city: { type: String, enum: ['Makkah', 'Madinah'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    people: { type: Number, required: true, min: 1 },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    totalCostSAR: { type: Number, required: true, min: 0 },
    checklist: [checklistItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
