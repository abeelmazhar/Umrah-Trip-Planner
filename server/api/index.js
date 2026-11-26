// Vercel serverless entry point: every request is rewritten here (see server/vercel.json).
const app = require('../src/app');
const connectDB = require('../src/config/db');

// Endpoints that are pure calculations and never touch the database.
const NO_DB = [
  '/api/health',
  '/api/crowd',
  '/api/prayer-times',
  '/api/best-times',
  '/api/miqat',
  '/api/meta',
  '/api/notifications/vapid-public-key',
];

module.exports = async (req, res) => {
  const needsDb = !NO_DB.some((p) => req.url.startsWith(p));
  if (needsDb) {
    try {
      await connectDB();
    } catch (err) {
      console.error('Database connection failed:', err.message);
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ message: 'Database unavailable' }));
    }
  }
  return app(req, res);
};
