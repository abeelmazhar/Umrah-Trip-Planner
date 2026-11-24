const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const RAMADAN_MONTH = 9;
const LAST_TEN_START_DAY = 21;
const FRIDAY = 5;
const SATURDAY = 6;

const hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/** Accepts a Date or "YYYY-MM-DD" and returns a Date at UTC midnight. */
function parseDate(value) {
  let d;
  if (value instanceof Date) d = value;
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) d = new Date(`${value}T00:00:00Z`);
  else d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Umm al-Qura (Saudi) Hijri date for a Gregorian date. */
function toHijri(date) {
  const parts = Object.fromEntries(
    hijriFormatter.formatToParts(parseDate(date)).map((p) => [p.type, p.value])
  );
  return { day: Number(parts.day), month: Number(parts.month), year: Number(parts.year) };
}

function normalizePrayer(prayer) {
  if (prayer === undefined || prayer === null || prayer === '') return null;
  const p = String(prayer).trim().toLowerCase();
  if (!PRAYERS.includes(p)) throw new Error(`Prayer must be one of: ${PRAYERS.join(', ')}`);
  return p;
}

/**
 * Estimated crowd level at the Haram.
 *  High   — Fridays, all of Ramadan (incl. the last 10 nights), and Maghrib/Isha
 *  Medium — Fajr/Dhuhr on the Saudi weekend (Friday/Saturday)
 *  Low    — otherwise
 * Returns { level, reasons, ... } so the UI can explain the badge.
 */
function crowdLevel(date, prayer) {
  const d = parseDate(date);
  const p = normalizePrayer(prayer);
  const weekday = d.getUTCDay();
  const hijri = toHijri(d);
  const isRamadan = hijri.month === RAMADAN_MONTH;
  const isLastTenNights = isRamadan && hijri.day >= LAST_TEN_START_DAY;
  const isWeekend = weekday === FRIDAY || weekday === SATURDAY;

  const reasons = [];
  if (weekday === FRIDAY) reasons.push('friday');
  if (isLastTenNights) reasons.push('lastTenNights');
  else if (isRamadan) reasons.push('ramadan');
  if (p === 'maghrib' || p === 'isha') reasons.push('eveningPrayer');

  let level = 'Low';
  if (reasons.length) level = 'High';
  else if (isWeekend && (p === 'fajr' || p === 'dhuhr')) {
    level = 'Medium';
    reasons.push('weekendPrayer');
  }

  return {
    date: d.toISOString().slice(0, 10),
    prayer: p,
    level,
    reasons,
    hijri,
    isRamadan,
    isLastTenNights,
  };
}

module.exports = { PRAYERS, crowdLevel, toHijri, parseDate };
