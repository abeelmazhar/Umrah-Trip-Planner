const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/tripController');

router.use(auth);

router.post('/quote', c.quote);
router.post('/', c.createTrip);
router.get('/', c.listTrips);
router.get('/:id', c.getTrip);
router.delete('/:id', c.deleteTrip);
router.patch('/:id/checklist/:itemId', c.updateChecklistItem);

module.exports = router;
