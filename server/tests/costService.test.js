const {
  VAT_RATE,
  calculateNights,
  calculateRooms,
  calculateTripCost,
} = require('../src/services/costService');

describe('calculateNights', () => {
  test('counts calendar nights between dates', () => {
    expect(calculateNights('2026-03-01', '2026-03-05')).toBe(4);
  });

  test('ignores time of day', () => {
    expect(calculateNights('2026-03-01T22:00:00Z', '2026-03-02T01:00:00Z')).toBe(1);
  });

  test('handles month boundaries', () => {
    expect(calculateNights('2026-01-30', '2026-02-02')).toBe(3);
  });

  test('rejects same-day or reversed ranges', () => {
    expect(() => calculateNights('2026-03-05', '2026-03-05')).toThrow();
    expect(() => calculateNights('2026-03-05', '2026-03-01')).toThrow();
  });

  test('rejects invalid dates', () => {
    expect(() => calculateNights('nope', '2026-03-01')).toThrow('Invalid date');
  });
});

describe('calculateRooms', () => {
  test.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
  ])('%i people need %i rooms', (people, rooms) => {
    expect(calculateRooms(people)).toBe(rooms);
  });

  test('rejects zero, negative and fractional people', () => {
    expect(() => calculateRooms(0)).toThrow();
    expect(() => calculateRooms(-2)).toThrow();
    expect(() => calculateRooms(1.5)).toThrow();
  });
});

describe('calculateTripCost', () => {
  test('VAT rate is 15%', () => {
    expect(VAT_RATE).toBe(0.15);
  });

  test('nights x price x rooms, plus 15% VAT', () => {
    const cost = calculateTripCost({
      startDate: '2026-03-01',
      endDate: '2026-03-04', // 3 nights
      people: 3, // 2 rooms
      pricePerNightSAR: 500,
    });
    expect(cost).toEqual({
      nights: 3,
      rooms: 2,
      pricePerNightSAR: 500,
      subtotalSAR: 3000,
      vatRate: 0.15,
      vatSAR: 450,
      totalCostSAR: 3450,
    });
  });

  test('rounds to 2 decimals', () => {
    const cost = calculateTripCost({
      startDate: '2026-03-01',
      endDate: '2026-03-02',
      people: 1,
      pricePerNightSAR: 333.33,
    });
    expect(cost.vatSAR).toBe(50);
    expect(cost.totalCostSAR).toBe(383.33);
  });

  test('rejects a negative price', () => {
    expect(() =>
      calculateTripCost({ startDate: '2026-03-01', endDate: '2026-03-02', people: 1, pricePerNightSAR: -1 })
    ).toThrow();
  });
});
