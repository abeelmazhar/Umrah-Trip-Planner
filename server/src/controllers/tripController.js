const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Hotel = require('../models/Hotel');
const { calculateTripCost } = require('../services/costService');
const { defaultChecklist } = require('../services/checklistService');

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Validates the trip input and loads the hotel. Returns { error } or { hotel, cost, data }. */
async function buildTrip(body) {
  const { city, startDate, endDate, hotelId } = body || {};
  const people = Number(body?.people);

  if (!['Makkah', 'Madinah'].includes(city)) return { error: 'City must be Makkah or Madinah' };
  if (!startDate || !endDate) return { error: 'startDate and endDate are required' };
  if (!Number.isInteger(people) || people < 1 || people > 50) {
    return { error: 'People must be a whole number between 1 and 50' };
  }
  if (!isId(hotelId)) return { error: 'A valid hotelId is required' };

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) return { error: 'Hotel not found', status: 404 };
  if (hotel.city !== city) return { error: `This hotel is in ${hotel.city}, not ${city}` };

  let cost;
  try {
    cost = calculateTripCost({ startDate, endDate, people, pricePerNightSAR: hotel.pricePerNightSAR });
  } catch (err) {
    return { error: err.message };
  }
  return { hotel, cost, data: { city, startDate, endDate, people, hotelId } };
}

// POST /api/trips/quote — price a trip without saving it (used by the wizard review step)
async function quote(req, res, next) {
  try {
    const result = await buildTrip(req.body);
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    return res.json({ hotel: result.hotel, ...result.cost });
  } catch (err) {
    return next(err);
  }
}

// POST /api/trips
async function createTrip(req, res, next) {
  try {
    const result = await buildTrip(req.body);
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    const trip = await Trip.create({
      ...result.data,
      userId: req.user.id,
      totalCostSAR: result.cost.totalCostSAR,
      checklist: defaultChecklist(),
    });
    await trip.populate('hotelId');
    return res.status(201).json({ trip, cost: result.cost });
  } catch (err) {
    return next(err);
  }
}

// GET /api/trips
async function listTrips(req, res, next) {
  try {
    const trips = await Trip.find({ userId: req.user.id }).sort({ startDate: 1 }).populate('hotelId');
    return res.json(trips);
  } catch (err) {
    return next(err);
  }
}

async function findOwnTrip(req, res) {
  if (!isId(req.params.id)) {
    res.status(400).json({ message: 'Invalid trip id' });
    return null;
  }
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) {
    res.status(404).json({ message: 'Trip not found' });
    return null;
  }
  return trip;
}

// GET /api/trips/:id
async function getTrip(req, res, next) {
  try {
    const trip = await findOwnTrip(req, res);
    if (!trip) return undefined;
    await trip.populate('hotelId');
    return res.json(trip);
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/trips/:id
async function deleteTrip(req, res, next) {
  try {
    const trip = await findOwnTrip(req, res);
    if (!trip) return undefined;
    await trip.deleteOne();
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/trips/:id/checklist/:itemId  { done: boolean }
async function updateChecklistItem(req, res, next) {
  try {
    const { done } = req.body || {};
    if (typeof done !== 'boolean') return res.status(400).json({ message: '"done" must be true or false' });
    const trip = await findOwnTrip(req, res);
    if (!trip) return undefined;
    const item = isId(req.params.itemId) ? trip.checklist.id(req.params.itemId) : null;
    if (!item) return res.status(404).json({ message: 'Checklist item not found' });
    item.done = done;
    await trip.save();
    return res.json(item);
  } catch (err) {
    return next(err);
  }
}

module.exports = { quote, createTrip, listTrips, getTrip, deleteTrip, updateChecklistItem };
