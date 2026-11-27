const mongoose = require('mongoose');

const { Schema } = mongoose;

const assistantUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    cacheReadTokens: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

assistantUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
assistantUsageSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AssistantUsage', assistantUsageSchema);
