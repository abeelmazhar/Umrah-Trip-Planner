const mongoose = require('mongoose');

const { Schema } = mongoose;

const assistantFeedbackSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'AssistantConversation', required: true },
    messageIndex: { type: Number, required: true, min: 0 },
    rating: { type: String, enum: ['up', 'down'], required: true },
    comment: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssistantFeedback', assistantFeedbackSchema);
