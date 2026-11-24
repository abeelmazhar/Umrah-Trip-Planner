/**
 * Prayer times for Makkah and Madinah using the Umm al-Qura method
 * (the official method in Saudi Arabia):
 *   Fajr: sun 18.5° below the horizon
 *   Isha: 90 minutes after Maghrib (120 minutes during Ramadan)
 *   Asr:  shadow = object length + noon shadow (standard / Shafi'i)
 * Astronomy follows the well-known PrayTimes.org formulas.
 * All times are Saudi local time (UTC+3, no daylight saving).
 */
const { toHijri, parseDate } = require('./crowdService');

const CITY_COORDS = {
  Makkah: { lat: 21.4225, lng: 39.8262 },
  Madinah: { lat: 24.4672, lng: 39.6111 },
};
const TIMEZONE = 3;
const FAJR_ANGLE = 18.5;
const ISHA_MINUTES = 90;
const ISHA_MINUTES_RAMADAN = 120;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));
const tan = (d) => Math.tan(rad(d));
const arcsin = (x) => deg(Math.asin(x));
const arccos = (x) => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const arctan2 = (y, x) => deg(Math.atan2(y, x));
const arccot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};
const fixAngle = (a) => fix(a, 360);
const fixHour = (h) => fix(h, 24);

function julian(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(arctan2(cos(e) * sin(L), cos(L)) / 15);
  return { declination: arcsin(sin(e) * sin(L)), equation: q / 15 - RA };
}

function computeDay(date, { lat, lng }) {
  const d = parseDate(date);
  const jDate = julian(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) - lng / (15 * 24);

  const midDay = (t) => fixHour(12 - sunPosition(jDate + t).equation);
  const sunAngleTime = (angle, t, ccw) => {
    const { declination } = sunPosition(jDate + t);
    const noon = midDay(t);
    const T = (1 / 15) * arccos((-sin(angle) - sin(declination) * sin(lat)) / (cos(declination) * cos(lat)));
    return noon + (ccw ? -T : T);
  };
  const asrTime = (factor, t) => {
    const { declination } = sunPosition(jDate + t);
    const angle = -arccot(factor + tan(Math.abs(lat - declination)));
    return sunAngleTime(angle, t);
  };

  // Two passes: first with rough default times, then refined with the results.
  let times = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18 };
  for (let pass = 0; pass < 2; pass += 1) {
    const p = Object.fromEntries(Object.entries(times).map(([k, v]) => [k, v / 24]));
    times = {
      fajr: sunAngleTime(FAJR_ANGLE, p.fajr, true),
      sunrise: sunAngleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(1, p.asr),
      sunset: sunAngleTime(0.833, p.sunset),
    };
  }
  const adjust = (h) => h + TIMEZONE - lng / 15;
  return Object.fromEntries(Object.entries(times).map(([k, v]) => [k, adjust(v)]));
}

/** Hours (e.g. 17.6342) to "HH:MM", rounded to the nearest minute. */
function toClock(hours) {
  const total = Math.round(fixHour(hours) * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Prayer times for a city and date.
 * Returns clock strings plus raw minutes-after-midnight (handy for comparisons).
 */
function prayerTimes(city, date) {
  const coords = CITY_COORDS[city];
  if (!coords) throw new Error('City must be Makkah or Madinah');
  const d = parseDate(date);
  const t = computeDay(d, coords);
  const isRamadan = toHijri(d).month === 9;
  const isha = t.sunset + (isRamadan ? ISHA_MINUTES_RAMADAN : ISHA_MINUTES) / 60;
  const hours = { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.sunset, isha };
  const minutes = Object.fromEntries(Object.entries(hours).map(([k, v]) => [k, Math.round(fixHour(v) * 60)]));
  const clock = Object.fromEntries(Object.entries(hours).map(([k, v]) => [k, toClock(v)]));
  return { city, date: d.toISOString().slice(0, 10), method: 'Umm al-Qura', isRamadan, times: clock, minutes };
}

module.exports = { CITY_COORDS, prayerTimes, toClock };
