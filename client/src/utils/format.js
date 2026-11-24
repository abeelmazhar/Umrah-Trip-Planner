const locale = (lang) => (lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB');

export function formatSAR(amount, lang) {
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Dates are stored as UTC midnight; format in UTC so the day never shifts.
export function formatDate(value, lang, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', ...opts }).format(new Date(value));
}

export function nightsBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).setUTCHours(0, 0, 0, 0) - new Date(start).setUTCHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

/** YYYY-MM-DD strings for each day from start (inclusive) to end (inclusive). */
export function daysBetween(start, end, max = 30) {
  const out = [];
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (d <= last && out.length < max) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
