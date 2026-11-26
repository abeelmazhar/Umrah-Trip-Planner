require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { runDueNotifications } = require('./services/notificationService');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
    // Local dev only. Production has no long-running process; cron-job.org calls the endpoint.
    const timer = setInterval(() => {
      runDueNotifications(new Date()).catch((err) => console.error('Notifications run failed:', err.message));
    }, 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
