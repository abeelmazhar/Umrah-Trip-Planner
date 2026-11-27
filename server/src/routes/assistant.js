const router = require('express').Router();
const auth = require('../middleware/auth');
const { assistantChatLimit } = require('../middleware/assistantRateLimit');
const c = require('../controllers/assistantController');

router.use(auth);
router.get('/status', c.status);
router.get('/conversation', c.conversation);
router.delete('/conversation', c.removeConversation);
router.post('/feedback', c.feedback);
router.post('/chat', assistantChatLimit, c.chat);

module.exports = router;
