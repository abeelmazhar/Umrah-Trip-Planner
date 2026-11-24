const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES } = require('../services/budgetService');

const { Schema } = mongoose;
const CITY = { type: String, enum: ['Makkah', 'Madinah'], required: true };

const checklistItemSchema = new Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
});

const staySchema = new Schema({
  city: CITY,
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  nights: { type: Number, required: true, min: 1 },
  pricePerNightSAR: { type: Number, required: true, min: 0 },
  subtotalSAR: { type: Number, required: true, min: 0 },
});

const transferSchema = new Schema({
  from: CITY,
  to: CITY,
  date: { type: Date, required: true },
  mode: { type: String, enum: ['train', 'bus', 'taxi'], required: true },
  costSAR: { type: Number, required: true, min: 0 },
});

const travellerSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  gender: { type: String, enum: ['male', 'female'], required: true },
  // Only the expiry date is stored — never the passport number.
  passportExpiry: { type: Date },
  meningitisVaccine: { type: Boolean, default: false },
});

const expenseSchema = new Schema(
  {
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amountSAR: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true, maxlength: 120, default: '' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const tripSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, maxlength: 80, default: '' },
    people: { type: Number, required: true, min: 1 },
    originRegion: { type: String, default: 'south-asia' },
    homeCurrency: { type: String, default: 'SAR' },

    stays: [staySchema],
    transfers: [transferSchema],
    startDate: { type: Date, required: true }, // first check-in (kept for sorting/listing)
    endDate: { type: Date, required: true }, // last check-out

    accommodationSubtotalSAR: { type: Number, default: 0 },
    vatSAR: { type: Number, default: 0 },
    transportSAR: { type: Number, default: 0 },
    totalCostSAR: { type: Number, required: true, min: 0 },

    travellers: [travellerSchema],
    budget: {
      flightsPerPersonSAR: { type: Number, default: 0, min: 0 },
      visaPerPersonSAR: { type: Number, default: 0, min: 0 },
      foodPerPersonPerDaySAR: { type: Number, default: 100, min: 0 },
      ziyaratSAR: { type: Number, default: 300, min: 0 },
      shoppingSAR: { type: Number, default: 500, min: 0 },
      otherSAR: { type: Number, default: 0, min: 0 },
    },
    expenses: [expenseSchema],

    // Umrah ritual companion: progress of the current Umrah, and how many are completed.
    ritual: {
      ihram: { type: Boolean, default: false },
      tawafRounds: { type: Number, default: 0, min: 0, max: 7 },
      saiRounds: { type: Number, default: 0, min: 0, max: 7 },
      halq: { type: Boolean, default: false },
      completedUmrahs: { type: Number, default: 0, min: 0 },
    },

    checklist: [checklistItemSchema],
    shareToken: { type: String, index: { unique: true, sparse: true } },

    // Legacy single-stay fields (trips created before multi-city support).
    city: { type: String, enum: ['Makkah', 'Madinah'] },
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
