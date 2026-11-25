const Group = require('../models/Group');
const Trip = require('../models/Trip');
const User = require('../models/User');
const g = require('../services/groupService');
const { currentStay } = require('../services/tripService');
const { localizeHotel } = require('../services/hotelService');
const { httpError, isId, assertId, cleanString, validate } = require('../utils/http');

/* ---------------------------------------------------------------- helpers */

const myMember = (group, userId) => group.members.find((m) => String(m.userId) === String(userId));
const leaderOf = (group) => group.members.find((m) => m.role === 'leader');

async function loadGroup(req, { leaderOnly = false } = {}) {
  assertId(req.params.id, 'group id');
  const group = await Group.findById(req.params.id);
  const me = group && myMember(group, req.user.id);
  if (!me) throw httpError(404, 'Group not found');
  if (leaderOnly && me.role !== 'leader') throw httpError(403, 'Only the group leader can do this');
  return { group, me };
}

async function uniqueCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = g.generateCode();
    if (!(await Group.exists({ code }))) return code;
  }
  throw httpError(503, 'Could not create a join code, please try again');
}

async function assertOwnTrip(tripId, userId) {
  if (!tripId) return undefined;
  if (!isId(tripId) || !(await Trip.exists({ _id: tripId, userId }))) throw httpError(400, 'Trip not found');
  return tripId;
}

/** Today's hotel for the group, from the leader's linked trip. */
async function groupHotel(group, now = new Date()) {
  if (!group.tripId) return { hotel: null, city: null };
  const trip = await Trip.findById(group.tripId).populate('stays.hotelId');
  const stay = trip && currentStay(trip.stays, now);
  return { hotel: stay ? localizeHotel(stay.hotelId) : null, city: stay?.city || null };
}

function presentGroup(group, me, { hotel, city }, now = new Date()) {
  const isLeader = me.role === 'leader';
  return {
    _id: group._id,
    name: group.name,
    code: group.code,
    leaderPhone: group.leaderPhone,
    tripId: isLeader ? group.tripId || null : undefined,
    isLeader,
    hotel: hotel ? { ...hotel, city } : null,
    members: group.members.map((m) => ({
      _id: m._id,
      displayName: m.displayName,
      phone: m.phone,
      role: m.role,
      isMe: String(m._id) === String(me._id),
      location: g.locationView(m, now),
    })),
    meetingPoints: g.sortMeetingPoints(group.meetingPoints, now),
    myCard: g.buildLostCard({ group, member: me, leader: leaderOf(group), hotel, city, now }),
    mySharing: g.isSharing(me, now) ? { until: me.sharingUntil } : null,
  };
}

async function sendGroup(res, group, me, status = 200) {
  res.status(status).json(presentGroup(group, me, await groupHotel(group)));
}

/* ---------------------------------------------------------------- handlers */

// POST /api/groups  { name, leaderPhone?, tripId?, displayName? }
async function createGroup(req, res) {
  const name = cleanString(req.body?.name, 80);
  if (!name) throw httpError(400, 'Group name is required');
  const leaderPhone = validate(() => g.parsePhone(req.body?.leaderPhone));
  const user = await User.findById(req.user.id);
  const group = await Group.create({
    name,
    code: await uniqueCode(),
    leaderId: req.user.id,
    leaderPhone,
    tripId: await assertOwnTrip(req.body?.tripId, req.user.id),
    members: [
      {
        userId: req.user.id,
        displayName: cleanString(req.body?.displayName, 80) || user.name,
        phone: leaderPhone,
        role: 'leader',
        cardToken: g.newCardToken(),
      },
    ],
  });
  await sendGroup(res, group, group.members[0], 201);
}

// GET /api/groups — groups I lead or belong to
async function listGroups(req, res) {
  const now = new Date();
  const groups = await Group.find({ 'members.userId': req.user.id }).sort({ updatedAt: -1 });
  res.json(
    groups.map((group) => {
      const me = myMember(group, req.user.id);
      return {
        _id: group._id,
        name: group.name,
        code: group.code,
        isLeader: me.role === 'leader',
        membersCount: group.members.length,
        sharingCount: group.members.filter((m) => g.isSharing(m, now)).length,
        nextMeetingPoint: g.sortMeetingPoints(group.meetingPoints, now)[0] || null,
      };
    })
  );
}

// GET /api/groups/:id
async function getGroup(req, res) {
  const { group, me } = await loadGroup(req);
  await sendGroup(res, group, me);
}

// PATCH /api/groups/:id  (leader)  { name?, leaderPhone?, tripId? }
async function updateGroup(req, res) {
  const { group, me } = await loadGroup(req, { leaderOnly: true });
  const { name, leaderPhone, tripId } = req.body || {};
  if (name !== undefined) {
    group.name = cleanString(name, 80);
    if (!group.name) throw httpError(400, 'Group name is required');
  }
  if (leaderPhone !== undefined) group.leaderPhone = validate(() => g.parsePhone(leaderPhone));
  if (tripId !== undefined) group.tripId = tripId ? await assertOwnTrip(tripId, req.user.id) : undefined;
  await group.save();
  await sendGroup(res, group, me);
}

// DELETE /api/groups/:id  (leader)
async function deleteGroup(req, res) {
  const { group } = await loadGroup(req, { leaderOnly: true });
  await group.deleteOne();
  res.status(204).end();
}

// POST /api/groups/:id/code  (leader) — new join code; the old one stops working
async function regenerateCode(req, res) {
  const { group } = await loadGroup(req, { leaderOnly: true });
  group.code = await uniqueCode();
  await group.save();
  res.json({ code: group.code });
}

// POST /api/groups/join  { code, displayName?, phone? }
async function joinGroup(req, res) {
  const code = g.normalizeCode(req.body?.code);
  if (code.length !== g.CODE_LENGTH) throw httpError(400, `Join code must have ${g.CODE_LENGTH} characters`);
  const group = await Group.findOne({ code });
  if (!group) throw httpError(404, 'No group found with this code');

  let me = myMember(group, req.user.id);
  if (!me) {
    if (group.members.length >= g.LIMITS.members) throw httpError(400, 'This group is full');
    const user = await User.findById(req.user.id);
    group.members.push({
      userId: req.user.id,
      displayName: cleanString(req.body?.displayName, 80) || user.name,
      phone: validate(() => g.parsePhone(req.body?.phone)),
      cardToken: g.newCardToken(),
    });
    await group.save();
    me = myMember(group, req.user.id);
  }
  await sendGroup(res, group, me, 201);
}

// PATCH /api/groups/:id/me  { displayName?, phone? }
async function updateMe(req, res) {
  const { group, me } = await loadGroup(req);
  const { displayName, phone } = req.body || {};
  if (displayName !== undefined) {
    me.displayName = cleanString(displayName, 80);
    if (!me.displayName) throw httpError(400, 'Name is required');
  }
  if (phone !== undefined) me.phone = validate(() => g.parsePhone(phone));
  await group.save();
  await sendGroup(res, group, me);
}

// DELETE /api/groups/:id/members/:memberId — leader removes someone, or a member leaves
async function removeMember(req, res) {
  const { group, me } = await loadGroup(req);
  const target = isId(req.params.memberId) && group.members.id(req.params.memberId);
  if (!target) throw httpError(404, 'Member not found');
  const self = String(target._id) === String(me._id);
  if (!self && me.role !== 'leader') throw httpError(403, 'Only the group leader can remove members');
  if (target.role === 'leader') throw httpError(400, 'The leader cannot leave; delete the group instead');
  target.deleteOne();
  await group.save();
  res.status(204).end();
}

// POST /api/groups/:id/meeting-points  (leader)  { title, place, time?, note? }
async function addMeetingPoint(req, res) {
  const { group, me } = await loadGroup(req, { leaderOnly: true });
  if (group.meetingPoints.length >= g.LIMITS.meetingPoints) throw httpError(400, 'Too many meeting points');
  group.meetingPoints.push(validate(() => g.parseMeetingPoint(req.body)));
  await group.save();
  await sendGroup(res, group, me, 201);
}

// DELETE /api/groups/:id/meeting-points/:pointId  (leader)
async function deleteMeetingPoint(req, res) {
  const { group, me } = await loadGroup(req, { leaderOnly: true });
  const point = isId(req.params.pointId) && group.meetingPoints.id(req.params.pointId);
  if (!point) throw httpError(404, 'Meeting point not found');
  point.deleteOne();
  await group.save();
  await sendGroup(res, group, me);
}

// PUT /api/groups/:id/location  { lat, lng, accuracy?, minutes? }
// With `minutes`: start sharing for that long. Without: update the position while sharing is on.
async function shareLocation(req, res) {
  const { group, me } = await loadGroup(req);
  const now = new Date();
  const position = validate(() => g.parseLocation(req.body));
  if (req.body?.minutes !== undefined) {
    const minutes = validate(() => g.parseShareMinutes(req.body.minutes));
    me.sharingUntil = new Date(now.getTime() + minutes * 60000);
  } else if (!me.sharingUntil || me.sharingUntil <= now) {
    throw httpError(409, 'Location sharing is off');
  }
  me.location = { ...position, updatedAt: now };
  await group.save();
  res.json({ until: me.sharingUntil });
}

// DELETE /api/groups/:id/location — stop sharing and forget the last position
async function stopLocation(req, res) {
  const { group, me } = await loadGroup(req);
  me.sharingUntil = undefined;
  me.location = undefined;
  await group.save();
  res.status(204).end();
}

// GET /api/lost/:token (public) — what the QR code on a lost card opens
async function getLostCard(req, res) {
  const token = String(req.params.token || '');
  const group = /^[a-f0-9]{32}$/.test(token) && (await Group.findOne({ 'members.cardToken': token }));
  if (!group) throw httpError(404, 'Card not found');
  const member = group.members.find((m) => m.cardToken === token);
  const { hotel, city } = await groupHotel(group);
  const { cardToken, ...card } = g.buildLostCard({ group, member, leader: leaderOf(group), hotel, city });
  res.json(card);
}

module.exports = {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  regenerateCode,
  joinGroup,
  updateMe,
  removeMember,
  addMeetingPoint,
  deleteMeetingPoint,
  shareLocation,
  stopLocation,
  getLostCard,
};
