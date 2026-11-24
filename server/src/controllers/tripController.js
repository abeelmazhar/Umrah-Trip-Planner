const crypto = require('crypto');
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Hotel = require('../models/Hotel');
const { calculateItineraryCost, calculateTripCost, round2 } = require('../services/costService');
const { defaultChecklist } = require('../services/checklistService');
const { miqatFor, ORIGIN_REGIONS } = require('../services/miqatService');
const { planBudget, summarizeExpenses, EXPENSE_CATEGORIES, DEFAULT_BUDGET } = require('../services/budgetService');
const { RATES, convertFromSAR } = require('../services/currencyService');
const { checkTravellers } = require('../services/documentService');

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const httpError = (status, message) => Object.assign(new Error(message), { status });

/* ---------------------------------------------------------------- helpers */

/**
 * Validates an itinerary request, loads the hotels and prices everything.
 * Body: { people, originRegion?, homeCurrency?, title?, stays: [{ city, hotelId, checkIn, checkOut }], transferModes: [] }
 */
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

  const ids = [...new Set(rawStays.map((s) => String(s.hotelId)))];
  const hotels = await Hotel.find({ _id: { $in: ids } });
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

  const data = {
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '',
    people,
    originRegion,
    homeCurrency,
    stays: cost.stays.map((s, i) => ({ ...s, hotelId: stays[i].hotelId })),
    transfers: cost.transfers.map((t) => ({ from: t.from, to: t.to, date: t.date, mode: t.mode, costSAR: t.costSAR })),
    startDate: stays[0].checkIn,
    endDate: stays[stays.length - 1].checkOut,
    accommodationSubtotalSAR: cost.accommodationSubtotalSAR,
    vatSAR: cost.vatSAR,
    transportSAR: cost.transportSAR,
    totalCostSAR: cost.totalCostSAR,
  };
  return { data, cost, hotels: byId };
}

/** Trips created before multi-city support had a single city/hotel. Convert them once. */
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
  trip.accommodationSubtotalSAR = c.subtotalSAR;
  trip.vatSAR = c.vatSAR;
  trip.transportSAR = 0;
  await trip.save();
  return trip;
}

/** Trip document + everything the UI derives from it (miqat, budget, document checks…). */
function present(trip) {
  const obj = trip.toObject();
  const nights = obj.stays.reduce((s, x) => s + x.nights, 0);
  const firstCity = obj.stays[0]?.city;
  const accommodationSAR = round2((obj.accommodationSubtotalSAR || 0) + (obj.vatSAR || 0));
  const plan = planBudget({
    people: obj.people,
    nights,
    accommodationSAR,
    transportSAR: obj.transportSAR || 0,
    budget: { ...DEFAULT_BUDGET, ...(obj.budget || {}) },
  });
  const spending = summarizeExpenses(obj.expenses, plan.planned);
  let miqat = null;
  try {
    miqat = firstCity ? miqatFor(obj.originRegion, firstCity) : null;
  } catch {
    miqat = null;
  }
  const visitsMakkah = obj.stays.some((s) => s.city === 'Makkah');
  const documents = checkTravellers(obj.travellers, { startDate: obj.startDate, people: obj.people });
  const currency = obj.homeCurrency || 'SAR';

  return {
    ...obj,
    insights: {
      nights,
      route: obj.stays.map((s) => s.city),
      miqat,
      warnings: visitsMakkah ? [] : ['noMakkahStay'],
      budget: plan,
      spending,
      documents,
      homeCurrency: {
        code: currency,
        rate: RATES[currency],
        totalCost: convertFromSAR(obj.totalCostSAR, currency),
        totalBudget: convertFromSAR(plan.totalSAR, currency),
        totalSpent: convertFromSAR(spending.totalSpentSAR, currency),
      },
    },
  };
}

async function loadOwnTrip(req) {
  if (!isId(req.params.id)) throw httpError(400, 'Invalid trip id');
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) throw httpError(404, 'Trip not found');
  return upgradeLegacy(trip);
}

const POPULATE = 'stays.hotelId';
const respond = async (res, trip, status = 200) => {
  await trip.populate(POPULATE);
  return res.status(status).json(present(trip));
};

/* ---------------------------------------------------------------- handlers */

// POST /api/trips/quote — price a trip without saving it (wizard review step)
async function quote(req, res) {
  const { data, cost, hotels } = await buildItinerary(req.body);
  const firstCity = data.stays[0].city;
  res.json({
    ...cost,
    stays: cost.stays.map((s, i) => ({ ...s, hotel: hotels.get(String(data.stays[i].hotelId)) })),
    miqat: miqatFor(data.originRegion, firstCity),
    warnings: data.stays.some((s) => s.city === 'Makkah') ? [] : ['noMakkahStay'],
    homeCurrency: { code: data.homeCurrency, totalCost: convertFromSAR(cost.totalCostSAR, data.homeCurrency) },
  });
}

// POST /api/trips
async function createTrip(req, res) {
  const { data } = await buildItinerary(req.body);
  const trip = await Trip.create({ ...data, userId: req.user.id, checklist: defaultChecklist() });
  return respond(res, trip, 201);
}

// GET /api/trips
async function listTrips(req, res) {
  const trips = await Trip.find({ userId: req.user.id }).sort({ startDate: 1 });
  const upgraded = await Promise.all(trips.map(upgradeLegacy));
  await Trip.populate(upgraded, { path: POPULATE });
  res.json(upgraded.map(present));
}

// GET /api/trips/:id
async function getTrip(req, res) {
  return respond(res, await loadOwnTrip(req));
}

// DELETE /api/trips/:id
async function deleteTrip(req, res) {
  const trip = await loadOwnTrip(req);
  await trip.deleteOne();
  res.status(204).end();
}

// PATCH /api/trips/:id  { title?, originRegion?, homeCurrency?, travellers?, budget? }
async function updateTrip(req, res) {
  const trip = await loadOwnTrip(req);
  const { title, originRegion, homeCurrency, travellers, budget } = req.body || {};
  if (title !== undefined) trip.title = String(title).trim().slice(0, 80);
  if (originRegion !== undefined) {
    if (!ORIGIN_REGIONS[originRegion]) throw httpError(400, 'Unknown origin region');
    trip.originRegion = originRegion;
  }
  if (homeCurrency !== undefined) {
    if (!RATES[homeCurrency]) throw httpError(400, 'Unsupported currency');
    trip.homeCurrency = homeCurrency;
  }
  if (travellers !== undefined) {
    if (!Array.isArray(travellers) || travellers.length > 50) throw httpError(400, 'travellers must be a list (max 50)');
    trip.travellers = travellers.map((t) => ({
      name: t.name,
      gender: t.gender,
      passportExpiry: t.passportExpiry || undefined,
      meningitisVaccine: Boolean(t.meningitisVaccine),
    }));
  }
  if (budget !== undefined) {
    for (const key of Object.keys(DEFAULT_BUDGET)) {
      if (budget[key] === undefined) continue;
      const v = Number(budget[key]);
      if (!Number.isFinite(v) || v < 0) throw httpError(400, `${key} must be a non-negative number`);
      trip.budget[key] = v;
    }
  }
  await trip.save();
  return respond(res, trip);
}

// PATCH /api/trips/:id/checklist/:itemId  { done }
async function updateChecklistItem(req, res) {
  const { done } = req.body || {};
  if (typeof done !== 'boolean') throw httpError(400, '"done" must be true or false');
  const trip = await loadOwnTrip(req);
  const item = isId(req.params.itemId) ? trip.checklist.id(req.params.itemId) : null;
  if (!item) throw httpError(404, 'Checklist item not found');
  item.done = done;
  await trip.save();
  res.json(item);
}

// POST /api/trips/:id/expenses  { category, amountSAR, note?, date? }
async function addExpense(req, res) {
  const { category, note, date } = req.body || {};
  const amountSAR = Number(req.body?.amountSAR);
  if (!EXPENSE_CATEGORIES.includes(category)) throw httpError(400, 'Unknown expense category');
  if (!Number.isFinite(amountSAR) || amountSAR <= 0 || amountSAR > 1e7) throw httpError(400, 'Amount must be greater than 0');
  const trip = await loadOwnTrip(req);
  if (trip.expenses.length >= 500) throw httpError(400, 'Too many expenses on this trip');
  trip.expenses.push({ category, amountSAR: round2(amountSAR), note: note || '', date: date || Date.now() });
  await trip.save();
  return respond(res, trip, 201);
}

// DELETE /api/trips/:id/expenses/:expenseId
async function deleteExpense(req, res) {
  const trip = await loadOwnTrip(req);
  const expense = isId(req.params.expenseId) ? trip.expenses.id(req.params.expenseId) : null;
  if (!expense) throw httpError(404, 'Expense not found');
  expense.deleteOne();
  await trip.save();
  return respond(res, trip);
}

// PATCH /api/trips/:id/ritual  { ihram?, tawafRounds?, saiRounds?, halq? }  or  { action: 'complete' | 'reset' }
async function updateRitual(req, res) {
  const trip = await loadOwnTrip(req);
  const body = req.body || {};
  const r = trip.ritual;
  if (body.action === 'complete') {
    if (!(r.ihram && r.tawafRounds === 7 && r.saiRounds === 7 && r.halq)) {
      throw httpError(400, 'Finish all steps before marking this Umrah complete');
    }
    r.completedUmrahs += 1;
    Object.assign(r, { ihram: false, tawafRounds: 0, saiRounds: 0, halq: false });
  } else if (body.action === 'reset') {
    Object.assign(r, { ihram: false, tawafRounds: 0, saiRounds: 0, halq: false });
  } else {
    for (const key of ['tawafRounds', 'saiRounds']) {
      if (body[key] === undefined) continue;
      const v = Number(body[key]);
      if (!Number.isInteger(v) || v < 0 || v > 7) throw httpError(400, `${key} must be between 0 and 7`);
      r[key] = v;
    }
    for (const key of ['ihram', 'halq']) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== 'boolean') throw httpError(400, `${key} must be true or false`);
      r[key] = body[key];
    }
    // Keep the rites in order: Sa'i only after Tawaf, Halq only after Sa'i.
    if (r.saiRounds > 0 && r.tawafRounds < 7) throw httpError(400, "Complete 7 rounds of Tawaf before Sa'i");
    if (r.halq && r.saiRounds < 7) throw httpError(400, "Complete 7 rounds of Sa'i before Halq/Taqsir");
  }
  await trip.save();
  res.json(trip.ritual);
}

// POST /api/trips/:id/share  → creates (or returns) a read-only link token
async function enableShare(req, res) {
  const trip = await loadOwnTrip(req);
  if (!trip.shareToken) {
    trip.shareToken = crypto.randomBytes(16).toString('hex');
    await trip.save();
  }
  res.json({ shareToken: trip.shareToken });
}

// DELETE /api/trips/:id/share
async function disableShare(req, res) {
  const trip = await loadOwnTrip(req);
  trip.shareToken = undefined;
  await trip.save();
  res.status(204).end();
}

// GET /api/share/:token  (public) — itinerary only; no travellers, budget or expenses
async function getShared(req, res) {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{32}$/.test(token)) throw httpError(404, 'Shared trip not found');
  const trip = await Trip.findOne({ shareToken: token });
  if (!trip) throw httpError(404, 'Shared trip not found');
  await upgradeLegacy(trip);
  await trip.populate(POPULATE);
  const t = trip.toObject();
  res.json({
    title: t.title,
    people: t.people,
    startDate: t.startDate,
    endDate: t.endDate,
    stays: t.stays.map((s) => ({
      city: s.city,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      nights: s.nights,
      hotel: s.hotelId && { name: s.hotelId.name, distanceToHaramM: s.hotelId.distanceToHaramM },
    })),
    transfers: t.transfers.map(({ from, to, date, mode }) => ({ from, to, date, mode })),
    completedUmrahs: t.ritual?.completedUmrahs || 0,
  });
}

module.exports = {
  quote,
  createTrip,
  listTrips,
  getTrip,
  deleteTrip,
  updateTrip,
  updateChecklistItem,
  addExpense,
  deleteExpense,
  updateRitual,
  enableShare,
  disableShare,
  getShared,
};
