const mongoose = require('mongoose');

const { Schema } = mongoose;

const prayerPrefsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    minutesBefore: { type: Number, default: 15 },
    prayers: { type: [String], default: () => ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] },
  },
  { _id: false }
);

const quietHoursSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '23:00' },
    end: { type: String, default: '04:00' },
  },
  { _id: false }
);

const notificationPrefsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    prayer: { type: prayerPrefsSchema, default: () => ({}) },
    transfers: { type: Boolean, default: true },
    checkOut: { type: Boolean, default: true },
    passport: { type: Boolean, default: true },
    nusukPermit: { type: Boolean, default: true },
    meetingPoints: { type: Boolean, default: true },
    quietHours: { type: quietHoursSchema, default: () => ({}) },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    preferredLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
