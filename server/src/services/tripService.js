/**
 * Trip business logic that is independent of HTTP:
 *   buildItinerary  – validate a request, load hotels, price everything
 *   upgradeLegacy   – convert single-hotel trips from v1 into the multi-stay format
 *   presentTrip     – trip + derived "insights" (miqat, budget, document checks, currency)
 *   currentStay     – which stay a date falls in (used by group lost cards)
 */
const Hotel = require('../models/Hotel');
const { calculateItineraryCost, calculateTripCost, round2 } = require('./costService');
const { miqatFor, ORIGIN_REGIONS } = require('./miqatService');
const { planBudget, summarizeExpenses, DEFAULT_BUDGET } = require('./budgetService');
const { RATES, convertFromSAR } = require('./currencyService');
const { checkTravellers } = require('./documentService');
const { localizeHotel } = require('./hotelService');
const { httpError, isId, cleanString } = require('../utils/http');

async function buildItinerary(body = {}) {
  const people = Number(body.people);
  if (!Number.isInteger(people) || people < 1 || people > 50) {
    throw httpError(400, 'People must be a whole number between 1 and 50');
  }
  const originRegion = body.originRegion || 'south-asia';
  if (!ORIGIN_REGIONS[originRegion]) throw httpError(400, 'Unknown origin region');
  const homeCurrency = body.homeCurrency || 'SAR';
  if (!RATES[homeCurrency]) throw httpError(400, 'Unsupported currency');

  const rawStays = Array.isArray(body.stays) ? body.stays : [];
  if (rawStays.some((s) => !isId(s.hotelId))) throw httpError(400, 'Each stay needs a valid hotelId');

  const hotels = await Hotel.find({ _id: { $in: [...new Set(rawStays.map((s) => String(s.hotelId)))] } });
  const byId = new Map(hotels.map((h) => [String(h._id), h]));

  const stays = rawStays.map((s, i) => {
    const hotel = byId.get(String(s.hotelId));
    if (!hotel) throw httpError(404, `Stay ${i + 1}: hotel not found`);
    if (hotel.city !== s.city) throw httpError(400, `Stay ${i + 1}: ${hotel.name} is in ${hotel.city}, not ${s.city}`);
    return { city: s.city, hotelId: hotel._id, checkIn: s.checkIn, checkOut: s.checkOut, pricePerNightSAR: hotel.pricePerNightSAR };
  });

  let cost;
  try {
    cost = calculateItineraryCost({ stays, people, transferModes: body.transferModes || [] });
  } catch (err) {
    throw httpError(400, err.message);
  }

  return {
    cost,
    hotels: byId,
    data: {
      title: cleanString(body.title, 80),
      people,
      originRegion,
      homeCurrency,
      stays: cost.stays.map((s, i) => ({ ...s, hotelId: stays[i].hotelId })),
      transfers: cost.transfers.map(({ from, to, date, mode, costSAR }) => ({ from, to, date, mode, costSAR })),
      startDate: stays[0].checkIn,
      endDate: stays[stays.length - 1].checkOut,
      accommodationSubtotalSAR: cost.accommodationSubtotalSAR,
      vatSAR: cost.vatSAR,
      transportSAR: cost.transportSAR,
      totalCostSAR: cost.totalCostSAR,
    },
  };
}

async function upgradeLegacy(trip) {
  if (trip.stays.length || !trip.hotelId) return trip;
  const hotel = await Hotel.findById(trip.hotelId);
  if (!hotel) return trip;
  const c = calculateTripCost({
    startDate: trip.startDate,
    endDate: trip.endDate,
    people: trip.people,
    pricePerNightSAR: hotel.pricePerNightSAR,
  });
  trip.stays = [
    {
      city: trip.city,
      hotelId: hotel._id,
      checkIn: trip.startDate,
      checkOut: trip.endDate,
      nights: c.nights,
      pricePerNightSAR: hotel.pricePerNightSAR,
      subtotalSAR: c.subtotalSAR,
    },
  ];
  Object.assign(trip, { accommodationSubtotalSAR: c.subtotalSAR, vatSAR: c.vatSAR, transportSAR: 0 });
  await trip.save();
  return trip;
}

function safeMiqat(originRegion, firstCity) {
  try {
    return firstCity ? miqatFor(originRegion, firstCity) : null;
  } catch {
    return null;
  }
}

function presentTrip(trip) {
  const obj = trip.toObject();
  obj.stays = obj.stays.map((s) => ({ ...s, hotelId: s.hotelId?.name ? localizeHotel(s.hotelId) : s.hotelId }));
  const nights = obj.stays.reduce((sum, s) => sum + s.nights, 0);
  const plan = planBudget({
    people: obj.people,
    nights,
    accommodationSAR: round2((obj.accommodationSubtotalSAR || 0) + (obj.vatSAR || 0)),
    transportSAR: obj.transportSAR || 0,
    budget: { ...DEFAULT_BUDGET, ...(obj.budget || {}) },
  });
  const spending = summarizeExpenses(obj.expenses, plan.planned);
  const code = obj.homeCurrency || 'SAR';

  return {
    ...obj,
    insights: {
      nights,
      route: obj.stays.map((s) => s.city),
      miqat: safeMiqat(obj.originRegion, obj.stays[0]?.city),
      warnings: obj.stays.some((s) => s.city === 'Makkah') ? [] : ['noMakkahStay'],
      budget: plan,
      spending,
      documents: checkTravellers(obj.travellers, { startDate: obj.startDate, people: obj.people }),
      homeCurrency: {
        code,
        rate: RATES[code],
        totalCost: convertFromSAR(obj.totalCostSAR, code),
        totalBudget: convertFromSAR(plan.totalSAR, code),
        totalSpent: convertFromSAR(spending.totalSpentSAR, code),
      },
    },
  };
}

const midnight = (d) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};

/**
 * The stay a pilgrim is in on `date`: the one whose [checkIn, checkOut) contains it,
 * otherwise the next upcoming stay, otherwise the last stay.
 */
function currentStay(stays = [], date = new Date()) {
  if (!stays.length) return null;
  const t = midnight(date);
  return (
    stays.find((s) => midnight(s.checkIn) <= t && t < midnight(s.checkOut)) ||
    stays.find((s) => midnight(s.checkIn) > t) ||
    stays[stays.length - 1]
  );
}

module.exports = { buildItinerary, upgradeLegacy, presentTrip, currentStay };
