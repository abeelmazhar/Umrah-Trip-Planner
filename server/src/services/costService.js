const VAT_RATE = 0.15;
const PEOPLE_PER_ROOM = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole nights between check-in and check-out (calendar days, time of day ignored). */
function calculateNights(startDate, endDate) {
  const nights = Math.round((toUtcMidnight(endDate) - toUtcMidnight(startDate)) / MS_PER_DAY);
  if (nights < 1) throw new Error('End date must be at least one day after start date');
  return nights;
}

/** Two people share a room. */
function calculateRooms(people) {
  if (!Number.isInteger(people) || people < 1) throw new Error('People must be a positive integer');
  return Math.ceil(people / PEOPLE_PER_ROOM);
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * totalCostSAR = nights x pricePerNight x ceil(people / 2) rooms, plus 15% VAT.
 * Returns the full breakdown so the client can show it on the review step.
 */
function calculateTripCost({ startDate, endDate, people, pricePerNightSAR }) {
  if (typeof pricePerNightSAR !== 'number' || pricePerNightSAR < 0) {
    throw new Error('pricePerNightSAR must be a non-negative number');
  }
  const nights = calculateNights(startDate, endDate);
  const rooms = calculateRooms(people);
  const subtotalSAR = round2(nights * pricePerNightSAR * rooms);
  const vatSAR = round2(subtotalSAR * VAT_RATE);
  const totalCostSAR = round2(subtotalSAR + vatSAR);
  return { nights, rooms, pricePerNightSAR, subtotalSAR, vatRate: VAT_RATE, vatSAR, totalCostSAR };
}

module.exports = { VAT_RATE, calculateNights, calculateRooms, calculateTripCost };
