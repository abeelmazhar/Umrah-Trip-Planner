const crypto = require('crypto');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const {
  parsePrefs,
  storedPrefs,
  vapidPublicKey,
  parseSubscription,
  runDueNotifications,
  sendTest,
} = require('../services/notificationService');
const { httpError, validate, cleanString } = require('../utils/http');

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!secret || scheme !== 'Bearer' || !token || token.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

// GET /api/notifications/vapid-public-key
function publicKey(req, res) {
  res.json({ publicKey: vapidPublicKey() });
}

// POST /api/notifications/subscribe
async function subscribe(req, res) {
  const { endpoint, keys } = validate(() => parseSubscription(req.body || {}));
  const doc = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: { userId: req.user.id, keys, userAgent: cleanString(req.headers['user-agent'], 200) },
      $setOnInsert: { endpoint, createdAt: new Date() },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ subscribed: true, id: doc._id });
}

// POST /api/notifications/unsubscribe  { endpoint }
async function unsubscribe(req, res) {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) throw httpError(400, 'endpoint is required');
  await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
  res.json({ subscribed: false });
}

// GET /api/notifications/preferences
async function getPreferences(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found');
  res.json({ notificationPrefs: parsePrefs(storedPrefs(user)) });
}

// PUT /api/notifications/preferences
async function updatePreferences(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found');
  const notificationPrefs = validate(() => parsePrefs(req.body || {}, storedPrefs(user)));
  user.notificationPrefs = notificationPrefs;
  await user.save();
  res.json({ notificationPrefs });
}

// POST /api/notifications/test
async function testNotification(req, res) {
  res.json(await sendTest(req.user.id));
}

// POST /api/cron/notifications
async function runCron(req, res) {
  if (!cronAuthorized(req)) return res.status(401).json({ message: 'Unauthorized' });
  res.json(await runDueNotifications(new Date()));
}

module.exports = {
  publicKey,
  subscribe,
  unsubscribe,
  getPreferences,
  updatePreferences,
  testNotification,
  runCron,
};
