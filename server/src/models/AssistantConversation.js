const mongoose = require('mongoose');

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    stopReason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assistantConversationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', default: null },
  messages: { type: [messageSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

// One conversation per user per trip. A missing trip is stored as null.
assistantConversationSchema.index({ userId: 1, tripId: 1 }, { unique: true });
assistantConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('AssistantConversation', assistantConversationSchema);
