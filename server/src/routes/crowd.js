const router = require('express').Router();
const { crowdLevel, PRAYERS } = require('../services/crowdService');

// GET /api/crowd?date=YYYY-MM-DD&prayer=fajr|dhuhr|asr|maghrib|isha
// Without "prayer", returns the level for the whole day plus a per-prayer breakdown.
router.get('/', (req, res) => {
  const { date, prayer } = req.query;
  if (!date) return res.status(400).json({ message: 'date query parameter is required (YYYY-MM-DD)' });
  try {
    const result = crowdLevel(date, prayer);
    if (!prayer) {
      result.prayers = Object.fromEntries(PRAYERS.map((p) => [p, crowdLevel(date, p).level]));
    }
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
