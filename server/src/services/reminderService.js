/**
 * Reminder rules. Pure: no database and no network, so the unit tests can call
 * buildReminders with a fixed "now".
 *
 * Trip dates are calendar days stored at UTC midnight. Every clock time below
 * is Asia/Riyadh (UTC+3, no daylight saving). Transfers only store a date, so
 * departure is taken as 10:00 Saudi time on that day.
 */
const { prayerTimes } = require('./prayerTimesService');
const { calendarDay, atRiyadh, riyadhMinutes } = require('../utils/riyadh');
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const MEETING_LEAD_MIN = 5;
const MEETING_WINDOW_MIN = 5;
const DEFAULT_WINDOW_MIN = 15;
const DEPARTURE_HOUR = 10;
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const DEFAULT_PREFS = {
  enabled: true,
  prayer: { enabled: false, minutesBefore: 15, prayers: [...PRAYERS] },
  transfers: true,
  checkOut: true,
  passport: true,
  nusukPermit: true,
  meetingPoints: true,
  quietHours: { enabled: false, start: '23:00', end: '04:00' },
};

const MODE_LABEL = { train: 'Train', bus: 'Bus', taxi: 'Taxi' };

function resolvePrefs(input) {
  const src = input && typeof input === 'object' ? input : {};
  const prayer = src.prayer && typeof src.prayer === 'object' ? src.prayer : {};
  const quiet = src.quietHours && typeof src.quietHours === 'object' ? src.quietHours : {};
  const prayers = Array.isArray(prayer.prayers) ? prayer.prayers.filter((p) => PRAYERS.includes(p)) : DEFAULT_PREFS.prayer.prayers;
  const minutes = Number.isInteger(prayer.minutesBefore) ? prayer.minutesBefore : DEFAULT_PREFS.prayer.minutesBefore;
  return {
    enabled: src.enabled !== false,
    prayer: { enabled: prayer.enabled === true, minutesBefore: minutes, prayers },
    transfers: src.transfers !== false,
    checkOut: src.checkOut !== false,
    passport: src.passport !== false,
    nusukPermit: src.nusukPermit !== false,
    meetingPoints: src.meetingPoints !== false,
    quietHours: {
      enabled: quiet.enabled === true,
      start: quiet.start || DEFAULT_PREFS.quietHours.start,
      end: quiet.end || DEFAULT_PREFS.quietHours.end,
    },
  };
}

function isGroupMember(group, userId) {
  const id = String(userId);
  if (group.leaderId != null && String(group.leaderId) === id) return true;
  return (group.members || []).some((m) => String(m.userId) === id);
}

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shiftDay(day, days) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatClock(date) {
  const total = riyadhMinutes(date);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseClock(hhmm) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function inQuietHours(date, quiet) {
  const start = parseClock(quiet.start);
  const end = parseClock(quiet.end);
  if (start == null || end == null || start === end) return false;
  const t = riyadhMinutes(date);
  if (start < end) return t >= start && t < end;
  return t >= start || t < end;
}

function isDue(sendAt, now, windowMin) {
  const delta = now.getTime() - sendAt.getTime();
  return delta >= 0 && delta < windowMin * MINUTE;
}

/** Meeting, travel and Fajr always get through. Everything else waits. */
function silenced(reminder, prefs) {
  if (!prefs.quietHours.enabled) return false;
  if (reminder.kind === 'meeting' || reminder.kind === 'transfer') return false;
  if (reminder.kind === 'prayer' && reminder.prayer === 'fajr') return false;
  return inQuietHours(reminder.sendAt, prefs.quietHours);
}

function addMonths(date, months) {
  const d = asDate(date);
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function hotelName(stay) {
  if (stay.hotelName) return stay.hotelName;
  const hotel = stay.hotel || stay.hotelId;
  if (hotel && typeof hotel === 'object' && hotel.name) return hotel.name;
  return 'your hotel';
}

function ihramSentence(trip, destination) {
  if (destination !== 'Makkah' || trip.ritual?.ihram) return '';
  return ' Wear ihram before boarding.';
}

function modeLabel(mode) {
  return MODE_LABEL[mode] || 'Transfer';
}

/**
 * Reminders that should be sent at `now`.
 * A meeting is due from 5 minutes before its time until that time.
 * Every other reminder is due for 15 minutes after its sendAt, so a late
 * cron run does not deliver it hours afterwards.
 *
 * @returns {Array<{ key, userId, sendAt, title, body, url, tag, urgent, kind }>}
 */
function buildReminders({ trip = null, user, groups = [], now }) {
  const at = asDate(now);
  if (!user || !at) return [];
  const prefs = resolvePrefs(user.notificationPrefs);
  if (!prefs.enabled) return [];

  const userId = user._id;
  const id = String(userId);
  const out = [];

  const push = (reminder) => {
    if (!reminder.sendAt || Number.isNaN(reminder.sendAt.getTime())) return;
    const windowMin = reminder.kind === 'meeting' ? MEETING_WINDOW_MIN : DEFAULT_WINDOW_MIN;
    if (!isDue(reminder.sendAt, at, windowMin) || silenced(reminder, prefs)) return;
    out.push({
      key: reminder.key,
      userId,
      sendAt: reminder.sendAt,
      title: reminder.title,
      body: reminder.body,
      url: reminder.url,
      tag: reminder.key,
      urgent: Boolean(reminder.urgent),
      kind: reminder.kind,
    });
  };

  if (prefs.meetingPoints) {
    groups.forEach((group) => {
      if (!isGroupMember(group, userId)) return;
      const groupId = String(group._id);
      (group.meetingPoints || []).forEach((point) => {
        const when = asDate(point.time);
        if (!when || at >= when) return;
        const note = point.note ? ` · ${String(point.note).trim()}` : '';
        push({
          kind: 'meeting',
          urgent: true,
          key: `meeting:${groupId}:${String(point._id)}:${when.toISOString()}:${id}`,
          sendAt: new Date(when.getTime() - MEETING_LEAD_MIN * MINUTE),
          title: 'Meeting in 5 minutes',
          body: `${point.title} at ${point.place} · ${formatClock(when)}${note}`,
          url: `/groups/${groupId}`,
        });
      });
    });
  }

  if (!trip) return out;
  const tripId = String(trip._id);
  const tripUrl = `/trips/${tripId}`;

  if (prefs.transfers) {
    (trip.transfers || []).forEach((transfer, index) => {
      const day = calendarDay(transfer.date);
      if (!day) return;
      const departure = atRiyadh(day, DEPARTURE_HOUR, 0);
      const tid = String(transfer._id || index);
      const label = modeLabel(transfer.mode);
      const ihram = ihramSentence(trip, transfer.to);
      const eveAt = atRiyadh(shiftDay(day, -1), 20, 0);
      push({
        kind: 'transfer',
        urgent: true,
        key: `transfer-eve:${tripId}:${tid}:${eveAt.toISOString()}:${id}`,
        sendAt: eveAt,
        title: 'Travel tomorrow',
        body: `${label} to ${transfer.to} tomorrow 10:00.${ihram}`,
        url: tripUrl,
      });
      const soonAt = new Date(departure.getTime() - 2 * 60 * MINUTE);
      push({
        kind: 'transfer',
        urgent: true,
        key: `transfer-2h:${tripId}:${tid}:${soonAt.toISOString()}:${id}`,
        sendAt: soonAt,
        title: 'Travel in 2 hours',
        body: `${label} to ${transfer.to} at 10:00.${ihram}`,
        url: tripUrl,
      });
    });
  }

  if (prefs.checkOut) {
    (trip.stays || []).forEach((stay, index) => {
      const day = calendarDay(stay.checkOut);
      if (!day) return;
      const sid = String(stay._id || index);
      const name = hotelName(stay);
      const place = `${name}, ${stay.city}`;
      const eveAt = atRiyadh(shiftDay(day, -1), 20, 0);
      push({
        kind: 'checkout',
        urgent: false,
        key: `checkout-eve:${tripId}:${sid}:${eveAt.toISOString()}:${id}`,
        sendAt: eveAt,
        title: 'Check-out tomorrow',
        body: `Check-out tomorrow from ${place}`,
        url: tripUrl,
      });
      const morning = atRiyadh(day, 9, 0);
      push({
        kind: 'checkout',
        urgent: false,
        key: `checkout-day:${tripId}:${sid}:${morning.toISOString()}:${id}`,
        sendAt: morning,
        title: 'Check-out today',
        body: `Check-out today from ${place}`,
        url: tripUrl,
      });
    });
  }

  if (prefs.passport && trip.endDate) {
    const limit = addMonths(trip.endDate, 6);
    (trip.travellers || []).forEach((traveller, index) => {
      const expiry = asDate(traveller.passportExpiry);
      if (!expiry || expiry >= limit || !traveller.name) return;
      const who = String(traveller._id || index);
      const expiryDay = calendarDay(expiry);
      const text = `${traveller.name}'s passport needs to be renewed before the trip.`;
      push({
        kind: 'passport',
        urgent: false,
        key: `passport:${tripId}:${who}:${expiryDay}:${id}`,
        sendAt: new Date(at.getTime()),
        title: 'Passport',
        body: text,
        url: tripUrl,
      });
      if (trip.startDate) {
        const remindDay = shiftDay(calendarDay(trip.startDate), -30);
        const sendAt = atRiyadh(remindDay, 9, 0);
        push({
          kind: 'passport',
          urgent: false,
          key: `passport-30d:${tripId}:${who}:${expiryDay}:${id}`,
          sendAt,
          title: 'Passport',
          body: text,
          url: tripUrl,
        });
      }
    });
  }

  if (prefs.nusukPermit && trip.startDate) {
    const item = (trip.checklist || []).find((entry) => entry.title === 'nusukPermit');
    if (item && !item.done) {
      const start = calendarDay(trip.startDate);
      for (let offset = -7; offset <= 0; offset += 1) {
        const day = shiftDay(start, offset);
        const sendAt = atRiyadh(day, 9, 0);
        push({
          kind: 'nusuk',
          urgent: false,
          key: `nusuk:${tripId}:${day}:${id}`,
          sendAt,
          title: 'Nusuk permit',
          body: 'The Nusuk permit is still not done. Book it before the trip.',
          url: tripUrl,
        });
      }
    }
  }

  if (prefs.prayer.enabled && prefs.prayer.prayers.length) {
    const cityByDay = new Map();
    (trip.stays || []).forEach((stay) => {
      const start = asDate(stay.checkIn);
      const end = asDate(stay.checkOut);
      if (!start || !end || !stay.city) return;
      for (let t = Date.parse(calendarDay(start)); t < Date.parse(calendarDay(end)); t += DAY) {
        cityByDay.set(new Date(t).toISOString().slice(0, 10), stay.city);
      }
    });
    cityByDay.forEach((city, day) => {
      let times;
      try {
        times = prayerTimes(city, day).times;
      } catch {
        return;
      }
      prefs.prayer.prayers.forEach((name) => {
        const clock = times[name];
        if (!clock) return;
        const [hour, minute] = clock.split(':').map(Number);
        const prayerAt = atRiyadh(day, hour, minute);
        const sendAt = new Date(prayerAt.getTime() - prefs.prayer.minutesBefore * MINUTE);
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        push({
          kind: 'prayer',
          prayer: name,
          urgent: false,
          key: `prayer:${tripId}:${city}:${day}:${name}:${sendAt.toISOString()}:${id}`,
          sendAt,
          title: `${label} in ${prefs.prayer.minutesBefore} minutes`,
          body: `${clock} in ${city}`,
          url: tripUrl,
        });
      });
    });
  }

  return out;
}

module.exports = {
  PRAYERS,
  DEFAULT_PREFS,
  buildReminders,
  isGroupMember,
  resolvePrefs,
};
