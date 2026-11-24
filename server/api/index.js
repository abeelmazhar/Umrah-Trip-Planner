// Vercel serverless entry point: every request is rewritten here (see server/vercel.json).
const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  // Health check and crowd endpoint don't need the database.
  const needsDb = !req.url.startsWith('/api/health') && !req.url.startsWith('/api/crowd');
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
