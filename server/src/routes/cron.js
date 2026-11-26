const router = require('express').Router();
const { runCron } = require('../controllers/notificationController');

router.post('/notifications', runCron);

module.exports = router;
