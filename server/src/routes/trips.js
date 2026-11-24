const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/tripController');

router.use(auth);

router.post('/quote', c.quote);
router.post('/', c.createTrip);
router.get('/', c.listTrips);
router.get('/:id', c.getTrip);
router.patch('/:id', c.updateTrip);
router.delete('/:id', c.deleteTrip);
router.patch('/:id/checklist/:itemId', c.updateChecklistItem);
router.post('/:id/expenses', c.addExpense);
router.delete('/:id/expenses/:expenseId', c.deleteExpense);
router.patch('/:id/ritual', c.updateRitual);
router.post('/:id/share', c.enableShare);
router.delete('/:id/share', c.disableShare);

module.exports = router;
