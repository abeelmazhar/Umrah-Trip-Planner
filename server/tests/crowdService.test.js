const { crowdLevel, toHijri } = require('../src/services/crowdService');

// Reference dates (Umm al-Qura calendar):
//   2026-11-24 Tue, 14 Jumada II 1448 — ordinary weekday
//   2026-11-27 Fri
//   2026-11-28 Sat
//   2026-02-18 Wed, 1 Ramadan 1447
//   2026-03-11 Wed, 22 Ramadan 1447 — last ten nights
//   2026-03-20 Fri, 1 Shawwal 1447

describe('toHijri', () => {
  test('converts to the Umm al-Qura calendar', () => {
    expect(toHijri('2026-02-18')).toEqual({ day: 1, month: 9, year: 1447 });
    expect(toHijri('2026-03-20')).toEqual({ day: 1, month: 10, year: 1447 });
  });
});

describe('crowdLevel', () => {
  test('Low on an ordinary weekday at Fajr/Dhuhr/Asr', () => {
    for (const p of ['fajr', 'dhuhr', 'asr']) {
      expect(crowdLevel('2026-11-24', p).level).toBe('Low');
    }
  });

  test('High at Maghrib and Isha on any day', () => {
    expect(crowdLevel('2026-11-24', 'maghrib').level).toBe('High');
    expect(crowdLevel('2026-11-24', 'Isha').level).toBe('High');
  });

  test('High all day on Friday', () => {
    for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', undefined]) {
      const r = crowdLevel('2026-11-27', p);
      expect(r.level).toBe('High');
      expect(r.reasons).toContain('friday');
    }
  });

  test('Medium at Fajr/Dhuhr on Saturday (weekend)', () => {
    expect(crowdLevel('2026-11-28', 'fajr').level).toBe('Medium');
    expect(crowdLevel('2026-11-28', 'dhuhr').level).toBe('Medium');
  });

  test('Low at Asr on Saturday', () => {
    expect(crowdLevel('2026-11-28', 'asr').level).toBe('Low');
  });

  test('High throughout Ramadan', () => {
    const r = crowdLevel('2026-02-18', 'asr');
    expect(r.level).toBe('High');
    expect(r.isRamadan).toBe(true);
    expect(r.isLastTenNights).toBe(false);
    expect(r.reasons).toContain('ramadan');
  });

  test('High in the last 10 nights of Ramadan', () => {
    const r = crowdLevel('2026-03-11', 'fajr');
    expect(r.level).toBe('High');
    expect(r.isLastTenNights).toBe(true);
    expect(r.reasons).toContain('lastTenNights');
  });

  test('Eid (1 Shawwal) is not Ramadan', () => {
    expect(crowdLevel('2026-03-20', 'asr').isRamadan).toBe(false);
  });

  test('accepts Date objects', () => {
    expect(crowdLevel(new Date('2026-11-24T15:00:00Z'), 'asr').level).toBe('Low');
  });

  test('rejects bad input', () => {
    expect(() => crowdLevel('not-a-date', 'fajr')).toThrow('Invalid date');
    expect(() => crowdLevel('2026-11-24', 'tahajjud')).toThrow(/Prayer must be/);
  });
});
