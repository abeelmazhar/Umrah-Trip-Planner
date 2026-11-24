const {
  calculateTransferCost,
  validateItinerary,
  requiredTransfers,
  calculateItineraryCost,
} = require('../src/services/costService');

const madinahThenMakkah = [
  { city: 'Madinah', checkIn: '2026-12-01', checkOut: '2026-12-04', pricePerNightSAR: 500 },
  { city: 'Makkah', checkIn: '2026-12-04', checkOut: '2026-12-09', pricePerNightSAR: 800 },
];

describe('calculateTransferCost', () => {
  test('train and bus are priced per person', () => {
    expect(calculateTransferCost('train', 3).costSAR).toBe(480);
    expect(calculateTransferCost('bus', 3).costSAR).toBe(240);
  });

  test('taxi is priced per vehicle of 4 seats', () => {
    expect(calculateTransferCost('taxi', 4)).toMatchObject({ vehicles: 1, costSAR: 550 });
    expect(calculateTransferCost('taxi', 5)).toMatchObject({ vehicles: 2, costSAR: 1100 });
  });

  test('rejects unknown modes', () => {
    expect(() => calculateTransferCost('camel', 2)).toThrow(/Transport mode/);
  });
});

describe('validateItinerary', () => {
  test('returns total nights', () => {
    expect(validateItinerary(madinahThenMakkah)).toBe(8);
  });

  test('rejects empty, overlapping, and bad-city itineraries', () => {
    expect(() => validateItinerary([])).toThrow(/at least one stay/);
    expect(() =>
      validateItinerary([
        { city: 'Makkah', checkIn: '2026-12-01', checkOut: '2026-12-05' },
        { city: 'Madinah', checkIn: '2026-12-03', checkOut: '2026-12-06' },
      ])
    ).toThrow(/starts before/);
    expect(() => validateItinerary([{ city: 'Jeddah', checkIn: '2026-12-01', checkOut: '2026-12-02' }])).toThrow(
      /city/
    );
  });

  test('rejects more than 90 nights', () => {
    expect(() => validateItinerary([{ city: 'Makkah', checkIn: '2026-01-01', checkOut: '2026-05-01' }])).toThrow(/90/);
  });
});

describe('requiredTransfers', () => {
  test('one transfer per city change only', () => {
    const stays = [
      { city: 'Makkah', checkIn: '2026-12-01', checkOut: '2026-12-03' },
      { city: 'Makkah', checkIn: '2026-12-03', checkOut: '2026-12-05' },
      { city: 'Madinah', checkIn: '2026-12-05', checkOut: '2026-12-08' },
    ];
    expect(requiredTransfers(stays)).toEqual([{ from: 'Makkah', to: 'Madinah', date: '2026-12-05', afterStay: 1 }]);
  });
});

describe('calculateItineraryCost', () => {
  test('hotels + 15% VAT on hotels + transport', () => {
    const c = calculateItineraryCost({ stays: madinahThenMakkah, people: 3, transferModes: ['train'] });
    // Madinah 3 nights x 500 x 2 rooms = 3000; Makkah 5 x 800 x 2 = 8000
    expect(c.accommodationSubtotalSAR).toBe(11000);
    expect(c.vatSAR).toBe(1650);
    expect(c.transportSAR).toBe(480);
    expect(c.totalCostSAR).toBe(13130);
    expect(c.nights).toBe(8);
    expect(c.transfers).toHaveLength(1);
  });

  test('requires a transport choice for each city change', () => {
    expect(() => calculateItineraryCost({ stays: madinahThenMakkah, people: 2 })).toThrow(/travel between cities/);
  });

  test('single-city trip needs no transport', () => {
    const c = calculateItineraryCost({ stays: [madinahThenMakkah[1]], people: 2 });
    expect(c.transportSAR).toBe(0);
    expect(c.totalCostSAR).toBe(4600);
  });
});
