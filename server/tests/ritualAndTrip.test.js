const { applyRitualUpdate } = require('../src/services/ritualService');
const { currentStay } = require('../src/services/tripService');
const { localizeHotel } = require('../src/services/hotelService');

const start = { ihram: false, tawafRounds: 0, saiRounds: 0, halq: false, completedUmrahs: 0 };

describe('applyRitualUpdate', () => {
  test('walks through the rites in order and completes', () => {
    let r = applyRitualUpdate(start, { ihram: true });
    r = applyRitualUpdate(r, { tawafRounds: 7 });
    r = applyRitualUpdate(r, { saiRounds: 7 });
    r = applyRitualUpdate(r, { halq: true });
    expect(applyRitualUpdate(r, { action: 'complete' })).toEqual({ ...start, completedUmrahs: 1 });
  });

  test('refuses steps out of order', () => {
    expect(() => applyRitualUpdate(start, { tawafRounds: 1 })).toThrow(/ihram/);
    expect(() => applyRitualUpdate({ ...start, ihram: true, tawafRounds: 6 }, { saiRounds: 1 })).toThrow(/Tawaf/);
    expect(() => applyRitualUpdate({ ...start, ihram: true, tawafRounds: 7, saiRounds: 3 }, { halq: true })).toThrow(/Sa'i/);
    expect(() => applyRitualUpdate(start, { action: 'complete' })).toThrow(/Finish/);
  });

  test('validates values and keeps the completed count on reset', () => {
    expect(() => applyRitualUpdate({ ...start, ihram: true }, { tawafRounds: 8 })).toThrow();
    expect(() => applyRitualUpdate(start, { ihram: 'yes' })).toThrow();
    expect(applyRitualUpdate({ ...start, ihram: true, tawafRounds: 4, completedUmrahs: 2 }, { action: 'reset' })).toEqual({
      ...start,
      completedUmrahs: 2,
    });
  });
});

describe('currentStay', () => {
  const stays = [
    { city: 'Madinah', checkIn: '2027-01-10', checkOut: '2027-01-13' },
    { city: 'Makkah', checkIn: '2027-01-13', checkOut: '2027-01-18' },
  ];

  test('stay containing the date (check-out day belongs to the next stay)', () => {
    expect(currentStay(stays, new Date('2027-01-11T20:00:00Z')).city).toBe('Madinah');
    expect(currentStay(stays, new Date('2027-01-13T08:00:00Z')).city).toBe('Makkah');
  });

  test('before the trip: the first upcoming stay; after it: the last stay', () => {
    expect(currentStay(stays, new Date('2026-12-01')).city).toBe('Madinah');
    expect(currentStay(stays, new Date('2027-03-01')).city).toBe('Makkah');
    expect(currentStay([], new Date())).toBeNull();
  });
});

describe('localizeHotel', () => {
  test('fills Arabic labels from seed data for older databases', () => {
    expect(localizeHotel({ name: 'Swissotel Makkah', city: 'Makkah' })).toMatchObject({ nameAr: 'فندق سويس أوتيل مكة' });
    expect(localizeHotel({ name: 'Unknown Hotel' }).nameAr).toBe('Unknown Hotel');
    expect(localizeHotel(null)).toBeNull();
  });
});
