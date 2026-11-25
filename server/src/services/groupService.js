/**
 * Group mode: pure helpers for join codes, input validation, live-location sharing
 * and the lost-pilgrim card. No database access here, so everything is unit-testable.
 */
const crypto = require('crypto');

// No 0/O, 1/I/L: easy to read aloud and type from a printed card.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const SHARE_MINUTES = [15, 30, 60, 120];
const STALE_AFTER_MS = 5 * 60 * 1000;
const LIMITS = { members: 100, meetingPoints: 30 };

function generateCode(randomBytes = crypto.randomBytes) {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** "abc-23 4" → "ABC234" */
const normalizeCode = (input) => String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const newCardToken = () => crypto.randomBytes(16).toString('hex');

/** Accepts international formats like "+966 50 123 4567"; returns '' for empty. Throws if invalid. */
function parsePhone(value) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  const phone = String(value).trim().replace(/\s+/g, ' ');
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new Error('Phone number looks invalid');
  }
  return phone;
}

function parseLocation({ lat, lng, accuracy } = {}) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || la < -90 || la > 90 || !Number.isFinite(ln) || ln < -180 || ln > 180) {
    throw new Error('Invalid coordinates');
  }
  const acc = Number(accuracy);
  return { lat: la, lng: ln, accuracy: Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null };
}

function parseShareMinutes(minutes) {
  const m = Number(minutes);
  if (!SHARE_MINUTES.includes(m)) throw new Error(`Share for one of: ${SHARE_MINUTES.join(', ')} minutes`);
  return m;
}

const isSharing = (member, now = new Date()) =>
  Boolean(member.sharingUntil && new Date(member.sharingUntil) > now && member.location?.updatedAt);

/** What other members may see of someone's location (null when not sharing). */
function locationView(member, now = new Date()) {
  if (!isSharing(member, now)) return null;
  const { lat, lng, accuracy, updatedAt } = member.location;
  return {
    lat,
    lng,
    accuracy,
    updatedAt,
    until: member.sharingUntil,
    stale: now - new Date(updatedAt) > STALE_AFTER_MS,
  };
}

function parseMeetingPoint({ title, place, time, note } = {}) {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);
  const point = { title: clean(title, 80), place: clean(place, 120), note: clean(note, 200) };
  if (!point.title || !point.place) throw new Error('Meeting point needs a title and a place');
  if (time) {
    const d = new Date(time);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid meeting time');
    point.time = d;
  }
  return point;
}

/** Upcoming meeting points first (soonest first), then ones without a time, then past ones. */
function sortMeetingPoints(points = [], now = new Date()) {
  const rank = (p) => (!p.time ? 1 : new Date(p.time) >= now ? 0 : 2);
  return [...points].sort((a, b) => rank(a) - rank(b) || new Date(a.time || 0) - new Date(b.time || 0));
}

/** Everything printed on a member's lost card. `hotel` is a localized hotel (or null). */
function buildLostCard({ group, member, leader, hotel, city, now = new Date() }) {
  const next = sortMeetingPoints(group.meetingPoints, now)[0];
  return {
    name: member.displayName,
    phone: member.phone || '',
    groupName: group.name,
    leader: { name: leader?.displayName || '', phone: group.leaderPhone || leader?.phone || '' },
    hotel: hotel
      ? { name: hotel.name, nameAr: hotel.nameAr, addressAr: hotel.addressAr, city: city || hotel.city }
      : null,
    meetingPoint: next ? { title: next.title, place: next.place, time: next.time || null } : null,
    cardToken: member.cardToken,
  };
}

module.exports = {
  CODE_ALPHABET,
  CODE_LENGTH,
  SHARE_MINUTES,
  LIMITS,
  generateCode,
  normalizeCode,
  newCardToken,
  parsePhone,
  parseLocation,
  parseShareMinutes,
  isSharing,
  locationView,
  parseMeetingPoint,
  sortMeetingPoints,
  buildLostCard,
};
