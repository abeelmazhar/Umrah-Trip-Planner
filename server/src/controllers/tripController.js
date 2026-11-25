const crypto = require('crypto');
const Trip = require('../models/Trip');
const { defaultChecklist } = require('../services/checklistService');
const { miqatFor, ORIGIN_REGIONS } = require('../services/miqatService');
const { EXPENSE_CATEGORIES, DEFAULT_BUDGET } = require('../services/budgetService');
const { RATES, convertFromSAR } = require('../services/currencyService');
const { applyRitualUpdate } = require('../services/ritualService');
const { localizeHotel } = require('../services/hotelService');
const { buildItinerary, upgradeLegacy, presentTrip } = require('../services/tripService');
const { round2 } = require('../services/costService');
const { httpError, isId, assertId, cleanString } = require('../utils/http');

const POPULATE = 'stays.hotelId';
const LIMITS = { travellers: 50, expenses: 500 };

async function loadOwnTrip(req) {
  assertId(req.params.id, 'trip id');
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) throw httpError(404, 'Trip not found');
  return upgradeLegacy(trip);
}

async function sendTrip(res, trip, status = 200) {
  await trip.populate(POPULATE);
  res.status(status).json(presentTrip(trip));
}

// POST /api/trips/quote — price an itinerary without saving it
async function quote(req, res) {
  const { data, cost, hotels } = await buildItinerary(req.body);
  res.json({
    ...cost,
    stays: cost.stays.map((s, i) => ({ ...s, hotel: localizeHotel(hotels.get(String(data.stays[i].hotelId))) })),
    miqat: miqatFor(data.originRegion, data.stays[0].city),
    warnings: data.stays.some((s) => s.city === 'Makkah') ? [] : ['noMakkahStay'],
    homeCurrency: { code: data.homeCurrency, totalCost: convertFromSAR(cost.totalCostSAR, data.homeCurrency) },
  });
}

// POST /api/trips
async function createTrip(req, res) {
  const { data } = await buildItinerary(req.body);
  const trip = await Trip.create({ ...data, userId: req.user.id, checklist: defaultChecklist() });
  await sendTrip(res, trip, 201);
}

// GET /api/trips
async function listTrips(req, res) {
  const trips = await Promise.all((await Trip.find({ userId: req.user.id }).sort({ startDate: 1 })).map(upgradeLegacy));
  await Trip.populate(trips, { path: POPULATE });
  res.json(trips.map(presentTrip));
}

// GET /api/trips/:id
const getTrip = async (req, res) => sendTrip(res, await loadOwnTrip(req));

// DELETE /api/trips/:id
async function deleteTrip(req, res) {
  await (await loadOwnTrip(req)).deleteOne();
  res.status(204).end();
}

function parseTravellers(list) {
  if (!Array.isArray(list) || list.length > LIMITS.travellers) throw httpError(400, 'travellers must be a list (max 50)');
  return list.map((t) => ({
    name: t.name,
    gender: t.gender,
    passportExpiry: t.passportExpiry || undefined,
    meningitisVaccine: Boolean(t.meningitisVaccine),
  }));
}

// PATCH /api/trips/:id  { title?, originRegion?, homeCurrency?, travellers?, budget? }
async function updateTrip(req, res) {
  const trip = await loadOwnTrip(req);
  const { title, originRegion, homeCurrency, travellers, budget } = req.body || {};

  if (title !== undefined) trip.title = cleanString(title, 80);
  if (originRegion !== undefined) {
    if (!ORIGIN_REGIONS[originRegion]) throw httpError(400, 'Unknown origin region');
    trip.originRegion = originRegion;
  }
  if (homeCurrency !== undefined) {
    if (!RATES[homeCurrency]) throw httpError(400, 'Unsupported currency');
    trip.homeCurrency = homeCurrency;
  }
  if (travellers !== undefined) trip.travellers = parseTravellers(travellers);
  if (budget !== undefined) {
    for (const key of Object.keys(DEFAULT_BUDGET)) {
      if (budget[key] === undefined) continue;
      const v = Number(budget[key]);
      if (!Number.isFinite(v) || v < 0) throw httpError(400, `${key} must be a non-negative number`);
      trip.budget[key] = v;
    }
  }
  await trip.save();
  await sendTrip(res, trip);
}

// PATCH /api/trips/:id/checklist/:itemId  { done }
async function updateChecklistItem(req, res) {
  const { done } = req.body || {};
  if (typeof done !== 'boolean') throw httpError(400, '"done" must be true or false');
  const trip = await loadOwnTrip(req);
  const item = isId(req.params.itemId) && trip.checklist.id(req.params.itemId);
  if (!item) throw httpError(404, 'Checklist item not found');
  item.done = done;
  await trip.save();
  res.json(item);
}

// POST /api/trips/:id/expenses  { category, amountSAR, note? }
async function addExpense(req, res) {
  const { category, note, date } = req.body || {};
  const amountSAR = Number(req.body?.amountSAR);
  if (!EXPENSE_CATEGORIES.includes(category)) throw httpError(400, 'Unknown expense category');
  if (!Number.isFinite(amountSAR) || amountSAR <= 0 || amountSAR > 1e7) throw httpError(400, 'Amount must be greater than 0');
  const trip = await loadOwnTrip(req);
  if (trip.expenses.length >= LIMITS.expenses) throw httpError(400, 'Too many expenses on this trip');
  trip.expenses.push({ category, amountSAR: round2(amountSAR), note: cleanString(note, 120), date: date || Date.now() });
  await trip.save();
  await sendTrip(res, trip, 201);
}

// DELETE /api/trips/:id/expenses/:expenseId
async function deleteExpense(req, res) {
  const trip = await loadOwnTrip(req);
  const expense = isId(req.params.expenseId) && trip.expenses.id(req.params.expenseId);
  if (!expense) throw httpError(404, 'Expense not found');
  expense.deleteOne();
  await trip.save();
  await sendTrip(res, trip);
}

// PATCH /api/trips/:id/ritual  { ihram?, tawafRounds?, saiRounds?, halq? } | { action: 'complete' | 'reset' }
async function updateRitual(req, res) {
  const trip = await loadOwnTrip(req);
  try {
    Object.assign(trip.ritual, applyRitualUpdate(trip.ritual.toObject(), req.body));
  } catch (err) {
    throw httpError(400, err.message);
  }
  await trip.save();
  res.json(trip.ritual);
}

// POST /api/trips/:id/share — create (or return) a read-only link token
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

// GET /api/share/:token (public) — itinerary only; no travellers, budget or expenses
async function getShared(req, res) {
  const token = String(req.params.token || '');
  const trip = /^[a-f0-9]{32}$/.test(token) && (await Trip.findOne({ shareToken: token }));
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
