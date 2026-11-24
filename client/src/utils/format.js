const locale = (lang) => (lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB');

export function formatMoney(amount, currency = 'SAR', lang = 'en') {
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount);
}

export const formatSAR = (amount, lang) => formatMoney(amount, 'SAR', lang);

// Dates are stored as UTC midnight; format in UTC so the day never shifts.
export function formatDate(value, lang, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', ...opts }).format(new Date(value));
}

export function formatHijri(value, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

const midnight = (v) => new Date(v).setUTCHours(0, 0, 0, 0);

export function nightsBetween(start, end) {
  if (!start || !end) return 0;
  return Math.round((midnight(end) - midnight(start)) / 86400000);
}

/** Days from today until a date (negative when in the past). */
export function daysUntil(date) {
  const today = new Date();
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((midnight(date) - t) / 86400000);
}

/** YYYY-MM-DD strings for each day from start (inclusive) to end (inclusive). */
export function daysBetween(start, end, max = 60) {
  const out = [];
  const d = new Date(midnight(start));
  const last = midnight(end);
  while (d.getTime() <= last && out.length < max) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const isoDay = (v) => new Date(v).toISOString().slice(0, 10);

export const todayISO = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
};

export function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
