const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/groupController');

router.use(auth);

router.post('/', c.createGroup);
router.get('/', c.listGroups);
router.post('/join', c.joinGroup);
router.get('/:id', c.getGroup);
router.patch('/:id', c.updateGroup);
router.delete('/:id', c.deleteGroup);
router.post('/:id/code', c.regenerateCode);
router.patch('/:id/me', c.updateMe);
router.delete('/:id/members/:memberId', c.removeMember);
router.post('/:id/meeting-points', c.addMeetingPoint);
router.delete('/:id/meeting-points/:pointId', c.deleteMeetingPoint);
router.put('/:id/location', c.shareLocation);
router.delete('/:id/location', c.stopLocation);

module.exports = router;
