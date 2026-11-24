const express = require('express');
const cors = require('cors');
const { getShared } = require('./controllers/tripController');

const app = express();

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hotels', require('./routes/hotels'));
app.use('/api/trips', require('./routes/trips'));
app.get('/api/share/:token', getShared);
app.use('/api', require('./routes/planning')); // crowd, prayer-times, best-times, miqat, meta

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ message: status >= 500 ? 'Server error' : err.message });
});

module.exports = app;
