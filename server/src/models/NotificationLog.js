const mongoose = require('mongoose');

const { Schema } = mongoose;

const notificationLogSchema = new Schema({
  key: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sentAt: { type: Date, default: Date.now },
});

// Drop the row after 30 days so the collection does not grow forever.
notificationLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
