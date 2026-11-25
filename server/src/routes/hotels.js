const router = require('express').Router();
const Hotel = require('../models/Hotel');
const { localizeHotel } = require('../services/hotelService');

// GET /api/hotels?city=Makkah — nearest to the Haram first
router.get('/', async (req, res) => {
  const filter = req.query.city ? { city: String(req.query.city) } : {};
  const hotels = await Hotel.find(filter).sort({ distanceToHaramM: 1 });
  res.json(hotels.map(localizeHotel));
});

module.exports = router;
