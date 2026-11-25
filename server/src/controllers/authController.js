const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../utils/http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANGUAGES = ['en', 'ar'];

const signToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
async function register(req, res) {
  const { name, email, password, preferredLanguage } = req.body || {};
  if (!name || !email || !password) throw httpError(400, 'Name, email and password are required');
  if (!EMAIL_RE.test(email)) throw httpError(400, 'Invalid email');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  if (await User.exists({ email: email.toLowerCase() })) throw httpError(409, 'Email already registered');

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    preferredLanguage: LANGUAGES.includes(preferredLanguage) ? preferredLanguage : 'en',
  });
  res.status(201).json({ token: signToken(user), user });
}

// POST /api/auth/login — same message for unknown email and wrong password
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw httpError(401, 'Invalid email or password');
  res.json({ token: signToken(user), user });
}

// GET /api/auth/me
async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found');
  res.json({ user });
}

// PATCH /api/auth/me  { preferredLanguage }
async function updateMe(req, res) {
  const { preferredLanguage } = req.body || {};
  if (!LANGUAGES.includes(preferredLanguage)) throw httpError(400, 'preferredLanguage must be "en" or "ar"');
  const user = await User.findByIdAndUpdate(req.user.id, { preferredLanguage }, { new: true });
  res.json({ user });
}

module.exports = { register, login, me, updateMe };
