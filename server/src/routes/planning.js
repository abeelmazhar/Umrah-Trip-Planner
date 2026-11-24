// Public planning endpoints that need no login and no database.
const router = require('express').Router();
const { crowdLevel, PRAYERS } = require('../services/crowdService');
const { prayerTimes } = require('../services/prayerTimesService');
const { bestTimes } = require('../services/bestTimesService');
const { miqatFor, ORIGIN_REGIONS, MIQATS } = require('../services/miqatService');
const { TRANSPORT, CITIES } = require('../services/costService');
const { RATES, RATES_AS_OF } = require('../services/currencyService');
const { EXPENSE_CATEGORIES, DEFAULT_BUDGET } = require('../services/budgetService');

const MAX_DAYS = 31;
const bad = (res, err) => res.status(400).json({ message: err.message });

function dateRange(start, days) {
  const n = days === undefined ? 1 : Number(days);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) throw new Error(`days must be between 1 and ${MAX_DAYS}`);
  const d = new Date(`${start}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start)) || Number.isNaN(d.getTime())) throw new Error('date must be YYYY-MM-DD');
  return Array.from({ length: n }, (_, i) => new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10));
}

// GET /api/crowd?date=YYYY-MM-DD&prayer=fajr
router.get('/crowd', (req, res) => {
  const { date, prayer } = req.query;
  if (!date) return res.status(400).json({ message: 'date query parameter is required (YYYY-MM-DD)' });
  try {
    const result = crowdLevel(date, prayer);
    if (!prayer) result.prayers = Object.fromEntries(PRAYERS.map((p) => [p, crowdLevel(date, p).level]));
    return res.json(result);
  } catch (err) {
    return bad(res, err);
  }
});

// GET /api/prayer-times?city=Makkah&date=YYYY-MM-DD&days=7
router.get('/prayer-times', (req, res) => {
  try {
    const days = dateRange(req.query.date, req.query.days);
    res.json(days.map((d) => prayerTimes(req.query.city, d)));
  } catch (err) {
    bad(res, err);
  }
});

// GET /api/best-times?city=Makkah&date=YYYY-MM-DD&days=7
router.get('/best-times', (req, res) => {
  try {
    const days = dateRange(req.query.date, req.query.days);
    res.json(days.map((d) => bestTimes(req.query.city, d)));
  } catch (err) {
    bad(res, err);
  }
});

// GET /api/miqat?origin=south-asia&firstCity=Makkah
router.get('/miqat', (req, res) => {
  try {
    res.json(miqatFor(req.query.origin, req.query.firstCity || 'Makkah'));
  } catch (err) {
    bad(res, err);
  }
});

// GET /api/meta — options the client needs to build forms
router.get('/meta', (req, res) => {
  res.json({
    cities: CITIES,
    transport: TRANSPORT,
    originRegions: ORIGIN_REGIONS,
    miqats: MIQATS,
    currencies: RATES,
    ratesAsOf: RATES_AS_OF,
    expenseCategories: EXPENSE_CATEGORIES,
    defaultBudget: DEFAULT_BUDGET,
  });
});

module.exports = router;
