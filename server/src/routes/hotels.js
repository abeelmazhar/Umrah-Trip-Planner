const router = require('express').Router();
const Hotel = require('../models/Hotel');

// GET /api/hotels?city=Makkah
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.city) filter.city = String(req.query.city);
    const hotels = await Hotel.find(filter).sort({ distanceToHaramM: 1 });
    res.json(hotels);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
