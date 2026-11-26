/**
 * Web Push delivery. Scheduling is runDueNotifications(now): safe to call
 * every minute from a local timer or from POST /api/cron/notifications.
 * Nothing here keeps a process alive, so it works on Vercel serverless.
 */
const Trip = require('../models/Trip');
const Group = require('../models/Group');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const NotificationLog = require('../models/NotificationLog');
const { buildReminders, DEFAULT_PREFS, PRAYERS } = require('./reminderService');
const pushTransport = require('./pushTransport');
const { httpError } = require('../utils/http');

const CONCURRENCY = 5;
const MINUTE_MS = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const BOOL_KEYS = ['enabled', 'transfers', 'checkOut', 'passport', 'nusukPermit', 'meetingPoints'];

function clonePrefs(prefs) {
  return {
    enabled: prefs.enabled,
    prayer: { ...prefs.prayer, prayers: [...prefs.prayer.prayers] },
    transfers: prefs.transfers,
    checkOut: prefs.checkOut,
    passport: prefs.passport,
    nusukPermit: prefs.nusukPermit,
    meetingPoints: prefs.meetingPoints,
    quietHours: { ...prefs.quietHours },
  };
}

function pickBool(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false`);
  return value;
}

/**
 * Merges a partial update onto base (defaults when omitted) and rejects bad input.
 * Throws a plain Error; controllers wrap it with validate().
 */
function parsePrefs(input = {}, base = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid notification preferences');
  if (input.prayer !== undefined && (!input.prayer || typeof input.prayer !== 'object' || Array.isArray(input.prayer))) {
    throw new Error('Invalid prayer preferences');
  }
  if (input.quietHours !== undefined && (!input.quietHours || typeof input.quietHours !== 'object' || Array.isArray(input.quietHours))) {
    throw new Error('Invalid quiet hours');
  }

  const stored = base && typeof base === 'object' ? base : {};
  const prefs = clonePrefs(DEFAULT_PREFS);
  BOOL_KEYS.forEach((key) => {
    const value = input[key] !== undefined ? input[key] : stored[key];
    if (value !== undefined) prefs[key] = pickBool(value, key);
  });

  const prayerIn = input.prayer || {};
  const prayerBase = stored.prayer || {};
  const prayerEnabled = prayerIn.enabled !== undefined ? prayerIn.enabled : prayerBase.enabled;
  if (prayerEnabled !== undefined) prefs.prayer.enabled = pickBool(prayerEnabled, 'prayer.enabled');
  const minutes = prayerIn.minutesBefore !== undefined ? prayerIn.minutesBefore : prayerBase.minutesBefore;
  if (minutes !== undefined) {
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > 120) {
      throw new Error('minutesBefore must be a whole number from 0 to 120');
    }
    prefs.prayer.minutesBefore = minutes;
  }
  const prayers = prayerIn.prayers !== undefined ? prayerIn.prayers : prayerBase.prayers;
  if (prayers !== undefined) {
    if (!Array.isArray(prayers) || prayers.some((p) => !PRAYERS.includes(p))) {
      throw new Error('prayers must be a list of fajr, dhuhr, asr, maghrib, isha');
    }
    prefs.prayer.prayers = [...new Set(prayers)];
  }

  const quietIn = input.quietHours || {};
  const quietBase = stored.quietHours || {};
  const quietEnabled = quietIn.enabled !== undefined ? quietIn.enabled : quietBase.enabled;
  if (quietEnabled !== undefined) prefs.quietHours.enabled = pickBool(quietEnabled, 'quietHours.enabled');
  ['start', 'end'].forEach((key) => {
    const value = quietIn[key] !== undefined ? quietIn[key] : quietBase[key];
    if (value === undefined) return;
    if (typeof value !== 'string' || !TIME_RE.test(value)) throw new Error(`quietHours.${key} must be HH:MM`);
    prefs.quietHours[key] = value;
  });
  return prefs;
}

function storedPrefs(user) {
  const raw = user?.notificationPrefs;
  if (!raw) return {};
  return typeof raw.toObject === 'function' ? raw.toObject() : raw;
}

function vapidPublicKey() {
  if (!process.env.VAPID_PUBLIC_KEY) throw httpError(503, 'Push notifications are not configured');
  return process.env.VAPID_PUBLIC_KEY;
}

function ensureVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) throw httpError(503, 'Push notifications are not configured');
  pushTransport.setVapidDetails(subject, pub, priv);
}

function parseSubscription({ endpoint, keys } = {}) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https:') || endpoint.length > 2000) {
    throw new Error('Invalid push endpoint');
  }
  const p256dh = keys?.p256dh;
  const authKey = keys?.auth;
  if (typeof p256dh !== 'string' || typeof authKey !== 'string' || !p256dh || !authKey || p256dh.length > 200 || authKey.length > 200) {
    throw new Error('Invalid push keys');
  }
  return { endpoint, keys: { p256dh, auth: authKey } };
}

function deliveryOptions(reminder) {
  const meeting = reminder.kind === 'meeting' || String(reminder.key).startsWith('meeting:');
  const transfer = reminder.kind === 'transfer' || String(reminder.key).startsWith('transfer-');
  return { TTL: meeting ? 600 : 3600, urgency: meeting || transfer ? 'high' : 'normal' };
}

function payloadFor(reminder) {
  return JSON.stringify({
    title: reminder.title,
    body: reminder.body,
    url: reminder.url,
    tag: reminder.tag || reminder.key,
    icon: '/icon-192.png',
    urgent: Boolean(reminder.urgent),
  });
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Sends one payload. Deletes subscriptions the push service reports as gone (404 or 410). */
async function sendToSubscriptions(subs, reminder) {
  const payload = payloadFor(reminder);
  const options = deliveryOptions(reminder);
  const results = await Promise.all(subs.map(async (sub) => {
    try {
      await pushTransport.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        payload,
        options
      );
      return 'sent';
    } catch (err) {
      const code = err.statusCode;
      if (code === 404 || code === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
        return 'gone';
      }
      console.error(`Push delivery failed (${code || 'network'})`);
      return 'failed';
    }
  }));
  return {
    delivered: results.filter((r) => r === 'sent').length,
    failed: results.some((r) => r === 'failed'),
  };
}

async function deliverReminder(reminder, subsByUser, now) {
  try {
    await NotificationLog.create({ key: reminder.key, userId: reminder.userId, sentAt: now });
  } catch (err) {
    if (err && err.code === 11000) return 'skipped';
    console.error('Notification log failed:', err.message);
    return 'failed';
  }
  const subs = subsByUser.get(String(reminder.userId)) || [];
  if (!subs.length) return 'failed';
  const result = await sendToSubscriptions(subs, reminder);
  if (result.delivered > 0) return 'sent';
  return 'failed';
}

/**
 * Loads trips and meetings that could be due, sends each reminder once.
 * Inserting the log row first makes two overlapping runs safe: the unique key
 * loses, and that run does not send a second push.
 */
async function runDueNotifications(now = new Date()) {
  const at = now instanceof Date ? now : new Date(now);
  const empty = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const from = new Date(at.getTime() - DAY);
  const soon = new Date(at.getTime() + 8 * DAY);
  // The 30-day passport reminder is outside the 8-day trip window, so load
  // just the trips whose start falls on that day as well.
  const passFrom = new Date(at.getTime() + 29 * DAY);
  const passTo = new Date(at.getTime() + 31 * DAY);

  const [trips, groups] = await Promise.all([
    Trip.find({
      $or: [
        { endDate: { $gte: from }, startDate: { $lte: soon } },
        { startDate: { $gte: passFrom, $lte: passTo }, endDate: { $gte: at } },
      ],
    }).populate('stays.hotelId'),
    Group.find({
      'meetingPoints.time': { $gt: at, $lte: new Date(at.getTime() + 20 * MINUTE_MS) },
    }),
  ]);

  const userIds = new Set();
  trips.forEach((trip) => userIds.add(String(trip.userId)));
  groups.forEach((group) => {
    if (group.leaderId) userIds.add(String(group.leaderId));
    (group.members || []).forEach((member) => userIds.add(String(member.userId)));
  });
  if (!userIds.size) return finish(empty);

  const subs = await PushSubscription.find({ userId: { $in: [...userIds] } });
  if (!subs.length) return finish(empty);
  const subscribedIds = [...new Set(subs.map((sub) => String(sub.userId)))];
  const users = await User.find({ _id: { $in: subscribedIds } });
  const subsByUser = new Map();
  subs.forEach((sub) => {
    const key = String(sub.userId);
    const list = subsByUser.get(key) || [];
    list.push(sub);
    subsByUser.set(key, list);
  });

  const reminders = [];
  users.forEach((user) => {
    const mine = trips.filter((trip) => String(trip.userId) === String(user._id));
    if (!mine.length) {
      reminders.push(...buildReminders({ trip: null, user, groups, now: at }));
      return;
    }
    mine.forEach((trip, index) => {
      reminders.push(...buildReminders({ trip, user, groups: index === 0 ? groups : [], now: at }));
    });
  });

  const counts = { checked: reminders.length, sent: 0, skipped: 0, failed: 0 };
  if (!reminders.length) return finish(counts);
  try {
    ensureVapid();
  } catch (err) {
    console.error('Notifications:', err.message);
    counts.failed = reminders.length;
    return finish(counts);
  }

  const outcomes = await mapLimit(reminders, CONCURRENCY, (reminder) => deliverReminder(reminder, subsByUser, at));
  outcomes.forEach((outcome) => {
    if (outcome === 'sent') counts.sent += 1;
    else if (outcome === 'skipped') counts.skipped += 1;
    else counts.failed += 1;
  });
  return finish(counts);
}

function finish(counts) {
  console.log(`Notifications: checked=${counts.checked} sent=${counts.sent} skipped=${counts.skipped} failed=${counts.failed}`);
  return counts;
}

async function sendTest(userId) {
  ensureVapid();
  const subs = await PushSubscription.find({ userId });
  if (!subs.length) throw httpError(400, 'No devices subscribed');
  const result = await sendToSubscriptions(subs, {
    key: `test:${userId}`,
    kind: 'test',
    title: 'Umrah Trip Planner',
    body: 'Test notification. Reminders are working on this device.',
    url: '/settings/notifications',
    tag: `test:${userId}`,
    urgent: false,
  });
  if (!result.delivered) throw httpError(502, 'Could not deliver the test notification');
  return { sent: result.delivered };
}

module.exports = {
  parsePrefs,
  storedPrefs,
  vapidPublicKey,
  parseSubscription,
  runDueNotifications,
  sendTest,
  sendToSubscriptions,
};
