const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/notificationController');

router.get('/vapid-public-key', c.publicKey);
router.use(auth);
router.post('/subscribe', c.subscribe);
router.post('/unsubscribe', c.unsubscribe);
router.get('/preferences', c.getPreferences);
router.put('/preferences', c.updatePreferences);
router.post('/test', c.testNotification);

module.exports = router;
