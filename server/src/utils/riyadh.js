/** Asia/Riyadh is UTC+3 all year. Trip dates are stored at UTC midnight, so the calendar day matches. */
const RIYADH_MS = 3 * 60 * 60 * 1000;

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD for a stored trip date. */
function calendarDay(value) {
  const d = asDate(value);
  return d ? d.toISOString().slice(0, 10) : null;
}

/** YYYY-MM-DD for a real timestamp, shifted into Saudi time. */
function riyadhDay(date) {
  return new Date(date.getTime() + RIYADH_MS).toISOString().slice(0, 10);
}

/** A clock time on a calendar day in Asia/Riyadh, as a UTC Date. */
function atRiyadh(day, hour, minute = 0) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - RIYADH_MS);
}

function riyadhMinutes(date) {
  const shifted = new Date(date.getTime() + RIYADH_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

module.exports = { RIYADH_MS, calendarDay, riyadhDay, atRiyadh, riyadhMinutes };
