const VAT_RATE = 0.15;
const PEOPLE_PER_ROOM = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_STAYS = 6;
const MAX_TOTAL_NIGHTS = 90; // Umrah visas are valid for up to 90 days
const CITIES = ['Makkah', 'Madinah'];

/**
 * Intercity transport between Makkah and Madinah (one way, prices include VAT).
 * Prices are illustrative averages; update them here when fares change.
 */
const TRANSPORT = {
  train: { pricing: 'perPerson', priceSAR: 160, durationMin: 140 }, // Haramain high-speed rail, economy
  bus: { pricing: 'perPerson', priceSAR: 80, durationMin: 300 }, // SAPTCO coach
  taxi: { pricing: 'perVehicle', priceSAR: 550, seats: 4, durationMin: 270 }, // private car / GMC
};

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
 * Single hotel stay: nights x pricePerNight x ceil(people / 2) rooms, plus 15% VAT.
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

/** Cost of one intercity transfer for a group. */
function calculateTransferCost(mode, people) {
  const option = TRANSPORT[mode];
  if (!option) throw new Error(`Transport mode must be one of: ${Object.keys(TRANSPORT).join(', ')}`);
  calculateRooms(people); // validates people
  if (option.pricing === 'perVehicle') {
    const vehicles = Math.ceil(people / option.seats);
    return { mode, vehicles, costSAR: round2(vehicles * option.priceSAR), durationMin: option.durationMin };
  }
  return { mode, costSAR: round2(people * option.priceSAR), durationMin: option.durationMin };
}

/**
 * Checks an itinerary: 1..6 stays, valid cities, each at least one night,
 * in date order without overlaps, at most 90 nights in total.
 * Stays are expected in travel order. Throws with a readable message.
 */
function validateItinerary(stays) {
  if (!Array.isArray(stays) || stays.length === 0) throw new Error('Add at least one stay');
  if (stays.length > MAX_STAYS) throw new Error(`A trip can have at most ${MAX_STAYS} stays`);
  let totalNights = 0;
  stays.forEach((s, i) => {
    if (!CITIES.includes(s.city)) throw new Error(`Stay ${i + 1}: city must be Makkah or Madinah`);
    totalNights += calculateNights(s.checkIn, s.checkOut);
    if (i > 0 && toUtcMidnight(s.checkIn) < toUtcMidnight(stays[i - 1].checkOut)) {
      throw new Error(`Stay ${i + 1} starts before stay ${i} ends`);
    }
  });
  if (totalNights > MAX_TOTAL_NIGHTS) throw new Error(`Total stay cannot exceed ${MAX_TOTAL_NIGHTS} nights`);
  return totalNights;
}

/** Where the group must move between cities: one entry per city change. */
function requiredTransfers(stays) {
  const out = [];
  for (let i = 1; i < stays.length; i += 1) {
    if (stays[i].city !== stays[i - 1].city) {
      out.push({ from: stays[i - 1].city, to: stays[i].city, date: stays[i].checkIn, afterStay: i - 1 });
    }
  }
  return out;
}

/**
 * Full itinerary price.
 *  stays:          [{ city, checkIn, checkOut, pricePerNightSAR }]
 *  transferModes:  one mode per city change, e.g. ['train']
 * Hotels are charged VAT; transport fares already include it.
 */
function calculateItineraryCost({ stays, people, transferModes = [] }) {
  const totalNights = validateItinerary(stays);
  const rooms = calculateRooms(people);

  const stayCosts = stays.map((s) => {
    const c = calculateTripCost({
      startDate: s.checkIn,
      endDate: s.checkOut,
      people,
      pricePerNightSAR: s.pricePerNightSAR,
    });
    return { city: s.city, checkIn: s.checkIn, checkOut: s.checkOut, nights: c.nights, rooms, pricePerNightSAR: s.pricePerNightSAR, subtotalSAR: c.subtotalSAR };
  });

  const needed = requiredTransfers(stays);
  if (transferModes.length < needed.length) {
    throw new Error('Choose how you will travel between cities');
  }
  const transfers = needed.map((t, i) => ({ ...t, ...calculateTransferCost(transferModes[i], people) }));

  const accommodationSubtotalSAR = round2(stayCosts.reduce((sum, s) => sum + s.subtotalSAR, 0));
  const vatSAR = round2(accommodationSubtotalSAR * VAT_RATE);
  const transportSAR = round2(transfers.reduce((sum, t) => sum + t.costSAR, 0));
  const totalCostSAR = round2(accommodationSubtotalSAR + vatSAR + transportSAR);

  return {
    nights: totalNights,
    rooms,
    stays: stayCosts,
    transfers,
    accommodationSubtotalSAR,
    vatRate: VAT_RATE,
    vatSAR,
    transportSAR,
    totalCostSAR,
  };
}

module.exports = {
  VAT_RATE,
  TRANSPORT,
  CITIES,
  MAX_STAYS,
  calculateNights,
  calculateRooms,
  calculateTripCost,
  calculateTransferCost,
  validateItinerary,
  requiredTransfers,
  calculateItineraryCost,
  round2,
};
