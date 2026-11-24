const mongoose = require('mongoose');

// Cache the connection promise so serverless invocations (Vercel) reuse one connection.
let connecting = null;

async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connecting) {
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000 })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.host}`);
        return m.connection;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

module.exports = connectDB;
