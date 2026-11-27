const claudeClient = require('../services/claudeClient');
const {
  REFUSAL_TEXT,
  statusFor,
  readConversation,
  clearConversation,
  prepareChat,
  saveExchange,
  addFeedback,
} = require('../services/assistantService');

function sendEvent(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function safeStreamError(err) {
  const Anthropic = claudeClient.sdk();
  if (err instanceof Anthropic.RateLimitError) {
    return 'The assistant is busy, please try again in a minute';
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error('Assistant authentication failed');
    return 'Assistant is not available';
  }
  if (err instanceof Anthropic.APIError) {
    console.error('Assistant request failed', err.status || err.constructor?.name);
    return 'The assistant could not answer just now. Please try again.';
  }
  console.error('Assistant request failed', err.status || err.constructor?.name || err.name);
  return 'The assistant could not answer just now. Please try again.';
}

function notConfigured(res) {
  return res.status(503).json({ message: 'Assistant is not configured' });
}

// GET /api/assistant/status
async function status(req, res) {
  res.json(await statusFor(req.user.id));
}

// GET /api/assistant/conversation?tripId=
async function conversation(req, res) {
  res.json(await readConversation(req.user.id, req.query.tripId));
}

// DELETE /api/assistant/conversation?tripId=
async function removeConversation(req, res) {
  await clearConversation(req.user.id, req.query.tripId);
  res.json({ cleared: true });
}

// POST /api/assistant/feedback
async function feedback(req, res) {
  const { tripId, messageIndex, rating, comment } = req.body || {};
  res.json(await addFeedback({
    userId: req.user.id,
    tripId,
    messageIndex,
    rating,
    comment,
  }));
}

// POST /api/assistant/chat  → text/event-stream
async function chat(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) return notConfigured(res);

  let started = false;
  let finished = false;
  try {
    const { question, tripId, language } = req.body || {};
    const prepared = await prepareChat({
      userId: req.user.id,
      question,
      tripId,
      language,
    });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    started = true;

    const stream = claudeClient.streamAnswer(prepared.params);
    const stopIfGone = () => {
      if (!finished) {
        try { stream.abort(); } catch { /* already closed */ }
      }
    };
    // The request "close" event also fires once the body has been read, while the
    // socket is still open. Abort only when the connection itself is gone.
    req.on('close', () => {
      if (req.socket?.destroyed) stopIfGone();
    });
    res.on('close', stopIfGone);

    let answer = '';
    stream.on('text', (delta) => {
      const piece = typeof delta === 'string' ? delta : '';
      answer += piece;
      sendEvent(res, 'delta', { text: piece });
    });

    const message = await stream.finalMessage();
    finished = true;
    const stopReason = message?.stop_reason || 'end_turn';

    if (stopReason === 'refusal') {
      answer = REFUSAL_TEXT;
      sendEvent(res, 'refusal', { text: REFUSAL_TEXT });
    } else if (!answer && Array.isArray(message?.content)) {
      answer = message.content.filter((block) => block?.type === 'text').map((block) => block.text || '').join('');
    }

    if (stopReason === 'max_tokens') {
      sendEvent(res, 'done', { stopReason, truncated: true });
    } else if (stopReason !== 'refusal') {
      sendEvent(res, 'done', { stopReason });
    }

    await saveExchange({
      userId: req.user.id,
      trip: prepared.trip,
      question: prepared.question,
      answer,
      stopReason,
      usage: message?.usage,
      day: prepared.day,
    });
    if (!res.writableEnded) res.end();
  } catch (err) {
    finished = true;
    if (!started || !res.headersSent) {
      if (err.status === 503) return notConfigured(res);
      throw err;
    }
    if (err?.constructor?.name === 'APIUserAbortError') {
      if (!res.writableEnded) res.end();
      return undefined;
    }
    sendEvent(res, 'error', { message: safeStreamError(err) });
    if (!res.writableEnded) res.end();
    return undefined;
  }
  return undefined;
}

module.exports = { status, conversation, removeConversation, feedback, chat };
