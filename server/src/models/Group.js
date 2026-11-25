const mongoose = require('mongoose');

const { Schema } = mongoose;

const memberSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  role: { type: String, enum: ['leader', 'member'], default: 'member' },
  // Random token behind the public lost-card QR code.
  cardToken: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  // Live location: only visible to the group, and only until sharingUntil.
  location: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    updatedAt: Date,
  },
  sharingUntil: { type: Date },
});

const meetingPointSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    place: { type: String, required: true, trim: true, maxlength: 120 },
    time: { type: Date },
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    code: { type: String, required: true, unique: true },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    leaderPhone: { type: String, trim: true, maxlength: 30, default: '' },
    // The leader's trip: the group's hotel for each day comes from its itinerary.
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    members: [memberSchema],
    meetingPoints: [meetingPointSchema],
  },
  { timestamps: true }
);

groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ 'members.cardToken': 1 });

module.exports = mongoose.model('Group', groupSchema);
