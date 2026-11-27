const WINDOW_MS = 60 * 1000;
const LIMIT = 10;
const buckets = new Map();

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** At most 10 chat requests per IP per minute, on top of the daily per-user quota. */
function assistantChatLimit(req, res, next) {
  const ip = clientIp(req);
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    bucket = { start: now, count: 0 };
    buckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (now - value.start >= WINDOW_MS) buckets.delete(key);
    }
  }
  if (bucket.count > LIMIT) {
    return res.status(429).json({ message: 'Too many requests. Try again in a minute.' });
  }
  return next();
}

function resetAssistantChatLimit() {
  buckets.clear();
}

module.exports = { assistantChatLimit, resetAssistantChatLimit };
