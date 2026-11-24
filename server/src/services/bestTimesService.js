/**
 * Suggests the quietest windows of the day for Tawaf / visiting the Haram.
 * Combines computed prayer times with the crowd rules. It is a heuristic,
 * not live data: mid-morning and early afternoon are usually quietest,
 * Fridays and Ramadan are busy all day, and summer afternoons are dangerously hot.
 */
const { prayerTimes, toClock } = require('./prayerTimesService');
const { crowdLevel, parseDate } = require('./crowdService');

const LEVEL_RANK = { Low: 0, Medium: 1, High: 2 };
const HOT_MONTHS = [5, 6, 7, 8, 9]; // May–September: afternoon temperatures often above 40°C

const fmt = (min) => toClock(min / 60);

function bestTimes(city, date) {
  const d = parseDate(date);
  const pt = prayerTimes(city, d);
  const m = pt.minutes;
  const day = crowdLevel(d);
  const friday = day.reasons.includes('friday');
  const ramadan = day.isRamadan;
  const lastTen = day.isLastTenNights;
  const hot = HOT_MONTHS.includes(d.getUTCMonth() + 1);

  const windows = [
    {
      key: 'morning',
      start: m.sunrise + 20,
      end: m.dhuhr - 45,
      // Before Jumu'ah the mosque fills from mid-morning.
      level: friday || lastTen ? 'High' : ramadan ? 'Medium' : 'Low',
      heat: false,
    },
    {
      key: 'afternoon',
      start: m.dhuhr + 40,
      end: m.asr - 20,
      level: friday || lastTen ? 'High' : ramadan ? 'Medium' : 'Low',
      heat: hot,
    },
    {
      key: 'lateNight',
      start: m.isha + 90,
      end: m.isha + 240,
      // Ramadan nights (Taraweeh / Qiyam) are the busiest time of the year.
      level: ramadan ? 'High' : 'Medium',
      heat: false,
    },
    {
      key: 'beforeFajr',
      start: m.fajr - 120,
      end: m.fajr - 30,
      level: ramadan ? 'High' : 'Medium',
      heat: false,
    },
  ].map((w) => ({ ...w, from: fmt(w.start), to: fmt(w.end) }));

  // Rank: crowd level first, then avoid heat, then earlier window.
  const ranked = [...windows].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || Number(a.heat) - Number(b.heat) || 0
  );
  const best = ranked[0];

  return {
    city,
    date: pt.date,
    prayerTimes: pt.times,
    dayLevel: day.level,
    reasons: day.reasons,
    windows: windows.map(({ start, end, ...w }) => w),
    best: best.key,
    heatWarning: hot,
  };
}

module.exports = { bestTimes, HOT_MONTHS };
