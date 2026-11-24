const { prayerTimes, toClock } = require('../src/services/prayerTimesService');
const { bestTimes } = require('../src/services/bestTimesService');

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const near = (actual, expected, tolerance = 3) => Math.abs(toMin(actual) - toMin(expected)) <= tolerance;

describe('prayerTimes (Umm al-Qura)', () => {
  // Reference values from published Makkah timetables (±3 min).
  test('Makkah, 24 Nov 2026', () => {
    const { times } = prayerTimes('Makkah', '2026-11-24');
    expect(near(times.fajr, '05:17')).toBe(true);
    expect(near(times.sunrise, '06:37')).toBe(true);
    expect(near(times.dhuhr, '12:07')).toBe(true);
    expect(near(times.asr, '15:15')).toBe(true);
    expect(near(times.maghrib, '17:37')).toBe(true);
  });

  test('Makkah, summer solstice', () => {
    const { times } = prayerTimes('Makkah', '2026-06-21');
    expect(near(times.fajr, '04:11')).toBe(true);
    expect(near(times.maghrib, '19:06')).toBe(true);
  });

  test('Isha is Maghrib + 90 min, or + 120 min in Ramadan', () => {
    const normal = prayerTimes('Makkah', '2026-11-24').minutes;
    expect(normal.isha - normal.maghrib).toBe(90);
    const ramadan = prayerTimes('Makkah', '2026-03-01');
    expect(ramadan.isRamadan).toBe(true);
    expect(ramadan.minutes.isha - ramadan.minutes.maghrib).toBe(120);
  });

  test('prayers are in order', () => {
    const m = prayerTimes('Madinah', '2026-01-15').minutes;
    expect(m.fajr < m.sunrise && m.sunrise < m.dhuhr && m.dhuhr < m.asr && m.asr < m.maghrib && m.maghrib < m.isha).toBe(
      true
    );
  });

  test('rejects unknown cities', () => {
    expect(() => prayerTimes('Riyadh', '2026-01-15')).toThrow();
  });

  test('toClock formats and wraps', () => {
    expect(toClock(5.5)).toBe('05:30');
    expect(toClock(24.25)).toBe('00:15');
  });
});

describe('bestTimes', () => {
  test('ordinary winter weekday: morning is best, no heat warning', () => {
    const r = bestTimes('Makkah', '2026-11-24');
    expect(r.best).toBe('morning');
    expect(r.heatWarning).toBe(false);
    expect(r.windows.find((w) => w.key === 'morning').level).toBe('Low');
  });

  test('summer afternoon is flagged as hot, so morning still wins', () => {
    const r = bestTimes('Makkah', '2026-07-14');
    expect(r.heatWarning).toBe(true);
    expect(r.windows.find((w) => w.key === 'afternoon').heat).toBe(true);
    expect(r.best).toBe('morning');
  });

  test('Friday mornings are busy', () => {
    const r = bestTimes('Makkah', '2026-11-27');
    expect(r.windows.find((w) => w.key === 'morning').level).toBe('High');
  });

  test('Ramadan nights are the busiest', () => {
    const r = bestTimes('Makkah', '2026-03-01');
    expect(r.windows.find((w) => w.key === 'lateNight').level).toBe('High');
  });
});
