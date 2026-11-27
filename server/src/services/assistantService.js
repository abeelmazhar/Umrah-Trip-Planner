const Trip = require('../models/Trip');
const Hotel = require('../models/Hotel');
const AssistantConversation = require('../models/AssistantConversation');
const AssistantUsage = require('../models/AssistantUsage');
const AssistantFeedback = require('../models/AssistantFeedback');
const { SYSTEM_PROMPT, buildTripContext } = require('./assistantPrompt');
const { httpError, assertId, cleanString } = require('../utils/http');

const RIYADH_MS = 3 * 60 * 60 * 1000;
const REFUSAL_TEXT = "I can't help with that here. Please ask a scholar or the Haram guidance desk.";
const DEFAULT_MODEL = 'claude-opus-5-5';

function validateQuestion(text) {
  const question = typeof text === 'string' ? text.trim() : '';
  if (question.length < 2 || question.length > 1000) {
    throw httpError(400, 'Question must be between 2 and 1000 characters');
  }
  return question;
}

/** Keep the newest messages, start with a user turn, and make roles alternate. */
function trimHistory(messages, maxMessages = 20) {
  const list = Array.isArray(messages) ? messages.slice(-maxMessages) : [];
  while (list.length && list[0].role !== 'user') list.shift();
  const out = [];
  list.forEach((message) => {
    const role = message?.role;
    if (role !== 'user' && role !== 'assistant') return;
    const content = String(message.content || '');
    if (!out.length) {
      if (role === 'user') out.push({ role, content });
      return;
    }
    if (out[out.length - 1].role === role) {
      out[out.length - 1] = { role, content: `${out[out.length - 1].content}\n${content}` };
      return;
    }
    out.push({ role, content });
  });
  return out;
}

function toApiMessages(history, question) {
  const messages = trimHistory(history);
  if (messages.length && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1] = {
      role: 'user',
      content: `${messages[messages.length - 1].content}\n${question}`,
    };
  } else {
    messages.push({ role: 'user', content: question });
  }
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

/** YYYY-MM-DD in Asia/Riyadh (UTC+3, no daylight saving). */
function riyadhDay(date) {
  return new Date(date.getTime() + RIYADH_MS).toISOString().slice(0, 10);
}

function checkQuota(usageCount, limit) {
  if (usageCount >= limit) throw httpError(429, 'Daily question limit reached. Try again tomorrow.');
}

function dailyLimit() {
  const n = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 30;
}

function modelId() {
  const model = typeof process.env.ASSISTANT_MODEL === 'string' ? process.env.ASSISTANT_MODEL.trim() : '';
  return model || DEFAULT_MODEL;
}

function appLanguage(value) {
  const lang = cleanString(value, 12);
  return /^[a-zA-Z-]{2,12}$/.test(lang) ? lang : 'en';
}

function buildRequest({ system, context, messages, model }) {
  return {
    model: model || DEFAULT_MODEL,
    max_tokens: 4096,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `<trip_context>\n${context}\n</trip_context>` },
    ],
    messages,
  };
}

async function loadOwnTrip(userId, tripId) {
  if (tripId === undefined || tripId === null || tripId === '') return null;
  assertId(tripId, 'trip id');
  const trip = await Trip.findOne({ _id: tripId, userId });
  if (!trip) throw httpError(404, 'Trip not found');
  return trip;
}

function tripFilter(userId, trip) {
  return { userId, tripId: trip ? trip._id : null };
}

async function statusFor(userId, now = new Date()) {
  const usage = await AssistantUsage.findOne({ userId, day: riyadhDay(now) });
  return {
    enabled: Boolean(process.env.ANTHROPIC_API_KEY),
    dailyLimit: dailyLimit(),
    usedToday: usage?.count || 0,
  };
}

async function readConversation(userId, tripId) {
  const trip = await loadOwnTrip(userId, tripId);
  const conversation = await AssistantConversation.findOne(tripFilter(userId, trip));
  return { messages: conversation ? conversation.messages : [] };
}

async function clearConversation(userId, tripId) {
  const trip = await loadOwnTrip(userId, tripId);
  await AssistantConversation.deleteOne(tripFilter(userId, trip));
}

async function prepareChat({ userId, question, tripId, language, now = new Date() }) {
  if (!process.env.ANTHROPIC_API_KEY) throw httpError(503, 'Assistant is not configured');
  const text = validateQuestion(question);
  const trip = await loadOwnTrip(userId, tripId);
  const day = riyadhDay(now);
  const limit = dailyLimit();
  const usage = await AssistantUsage.findOne({ userId, day });
  checkQuota(usage?.count || 0, limit);
  await AssistantUsage.findOneAndUpdate(
    { userId, day },
    {
      $inc: { count: 1 },
      $setOnInsert: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const conversation = await AssistantConversation.findOne(tripFilter(userId, trip));
  const ids = (trip?.stays || []).map((stay) => stay.hotelId).filter(Boolean);
  const hotels = ids.length ? await Hotel.find({ _id: { $in: ids } }).lean() : [];
  const hotelsById = Object.fromEntries(hotels.map((hotel) => [String(hotel._id), hotel]));
  const context = buildTripContext({
    trip,
    hotelsById,
    appLanguage: appLanguage(language),
    now,
  });
  const messages = toApiMessages(conversation?.messages || [], text);
  const params = buildRequest({
    system: SYSTEM_PROMPT,
    context,
    messages,
    model: modelId(),
  });
  return { params, question: text, trip, day };
}

async function saveExchange({ userId, trip, question, answer, stopReason, usage, day }) {
  const filter = tripFilter(userId, trip);
  const existing = await AssistantConversation.findOne(filter);
  const now = new Date();
  const messages = (existing?.messages || []).map((message) => ({
    role: message.role,
    content: message.content,
    stopReason: message.stopReason,
    createdAt: message.createdAt,
  }));
  messages.push({ role: 'user', content: String(question).slice(0, 8000), createdAt: now });
  messages.push({
    role: 'assistant',
    content: String(answer).slice(0, 8000),
    stopReason: stopReason || '',
    createdAt: now,
  });
  await AssistantConversation.findOneAndUpdate(
    filter,
    { $set: { messages: messages.slice(-40), updatedAt: now } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const tokens = usage || {};
  await AssistantUsage.updateOne(
    { userId, day },
    {
      $inc: {
        inputTokens: tokens.input_tokens || 0,
        outputTokens: tokens.output_tokens || 0,
        cacheReadTokens: tokens.cache_read_input_tokens || 0,
      },
    }
  );
}

async function addFeedback({ userId, tripId, messageIndex, rating, comment }) {
  if (rating !== 'up' && rating !== 'down') throw httpError(400, 'Rating must be up or down');
  if (!Number.isInteger(messageIndex) || messageIndex < 0) throw httpError(400, 'Invalid message');
  const trip = await loadOwnTrip(userId, tripId);
  const conversation = await AssistantConversation.findOne(tripFilter(userId, trip));
  if (!conversation) throw httpError(404, 'Conversation not found');
  const message = conversation.messages[messageIndex];
  if (!message || message.role !== 'assistant') throw httpError(400, 'Invalid message');
  await AssistantFeedback.findOneAndUpdate(
    { userId, conversationId: conversation._id, messageIndex },
    {
      $set: { rating, comment: cleanString(comment, 300) },
      $setOnInsert: { userId, conversationId: conversation._id, messageIndex },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return { ok: true };
}

module.exports = {
  REFUSAL_TEXT,
  DEFAULT_MODEL,
  validateQuestion,
  trimHistory,
  toApiMessages,
  riyadhDay,
  checkQuota,
  dailyLimit,
  buildRequest,
  statusFor,
  readConversation,
  clearConversation,
  prepareChat,
  saveExchange,
  addFeedback,
};
