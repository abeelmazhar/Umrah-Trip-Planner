// Assistant chat: auth, quota, and a fake OpenRouter stream. No real API calls.
const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { app, request, startDb, stopDb, register, auth } = require('./setup');
const AssistantConversation = require('../../src/models/AssistantConversation');
const AssistantUsage = require('../../src/models/AssistantUsage');
const openRouterClient = require('../../src/services/openRouterClient');
const { resetAssistantChatLimit } = require('../../src/middleware/assistantRateLimit');

const originalStream = openRouterClient.streamAnswer;
let nextMessage = { stop_reason: 'end_turn', usage: { input_tokens: 12, output_tokens: 7, cache_read_input_tokens: 3 } };
let nextDeltas = ['Walk ', 'to the Haram.'];

function fakeStream() {
  const listeners = [];
  return {
    aborted: false,
    on(event, cb) {
      if (event === 'text') listeners.push(cb);
      return this;
    },
    abort() {
      this.aborted = true;
    },
    async finalMessage() {
      if (this.aborted) {
        const err = new Error('aborted');
        err.name = 'APIUserAbortError';
        throw err;
      }
      nextDeltas.forEach((delta) => listeners.forEach((cb) => cb(delta)));
      return nextMessage;
    },
  };
}

function eventsOf(text) {
  return String(text)
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const event = (block.match(/^event: (.+)$/m) || [])[1];
      const data = (block.match(/^data: (.+)$/m) || [])[1];
      return { event, data: JSON.parse(data) };
    });
}

before(async () => {
  await startDb();
  process.env.OPENROUTER_API_KEY = '';
  process.env.ASSISTANT_DAILY_LIMIT = '30';
  process.env.ASSISTANT_MODEL = 'anthropic/claude-opus-5.5';
  openRouterClient.streamAnswer = () => fakeStream();
  resetAssistantChatLimit();
});

after(async () => {
  openRouterClient.streamAnswer = originalStream;
  await stopDb();
});

describe('assistant', () => {
  test('returns 401 without a token', async () => {
    expect((await request(app).get('/api/assistant/status')).status).toBe(401);
    expect((await request(app).post('/api/assistant/chat').send({ question: 'Hello there' })).status).toBe(401);
  });

  test('returns 503 when the API key is unset', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const token = await register('assistant-off@test.dev');
    const res = await request(app).post('/api/assistant/chat').set(auth(token)).send({ question: 'Hello there' });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Assistant is not configured');
    const status = await request(app).get('/api/assistant/status').set(auth(token));
    expect(status.status).toBe(200);
    expect(status.body.enabled).toBe(false);
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  test('returns 404 for someone else\'s trip and 400 for an empty question', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const owner = await register('assistant-owner@test.dev');
    const other = await register('assistant-other@test.dev');
    const hotels = await request(app).get('/api/hotels?city=Makkah');
    const created = await request(app).post('/api/trips').set(auth(owner)).send({
      people: 2,
      originRegion: 'south-asia',
      homeCurrency: 'SAR',
      stays: [{ city: 'Makkah', hotelId: hotels.body[0]._id, checkIn: '2027-02-01', checkOut: '2027-02-04' }],
      transferModes: [],
    });
    expect(created.status).toBe(201);

    const missing = await request(app)
      .post('/api/assistant/chat')
      .set(auth(other))
      .send({ question: 'Where is my hotel?', tripId: created.body._id });
    expect(missing.status).toBe(404);

    const empty = await request(app).post('/api/assistant/chat').set(auth(owner)).send({ question: ' ' });
    expect(empty.status).toBe(400);
  });

  test('streams delta events then done, and saves the messages and usage', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    nextDeltas = ['Walk ', 'to the Haram.'];
    nextMessage = { stop_reason: 'end_turn', usage: { input_tokens: 12, output_tokens: 7, cache_read_input_tokens: 3 } };
    const token = await register('assistant-stream@test.dev', 'Noor');
    const res = await request(app)
      .post('/api/assistant/chat')
      .set(auth(token))
      .send({ question: 'How do I reach the Haram?', language: 'en' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = eventsOf(res.text);
    expect(events.map((event) => event.event)).toEqual(['delta', 'delta', 'done']);
    expect(events[0].data).toEqual({ text: 'Walk ' });
    expect(events[2].data.stopReason).toBe('end_turn');

    const me = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const saved = await AssistantConversation.findOne({ userId: me.id, tripId: null });
    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[0].content).toBe('How do I reach the Haram?');
    expect(saved.messages[1].content).toBe('Walk to the Haram.');
    const usage = await AssistantUsage.findOne({ userId: me.id });
    expect(usage.count).toBe(1);
    expect(usage.inputTokens).toBe(12);
    expect(usage.outputTokens).toBe(7);
    expect(usage.cacheReadTokens).toBe(3);
  });

  test('returns 429 after the daily limit', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ASSISTANT_DAILY_LIMIT = '1';
    const token = await register('assistant-limit@test.dev');
    const first = await request(app).post('/api/assistant/chat').set(auth(token)).send({ question: 'What is ihram?' });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/assistant/chat').set(auth(token)).send({ question: 'What is ihram?' });
    expect(second.status).toBe(429);
    expect(second.body.message).toBe('Daily question limit reached. Try again tomorrow.');
    process.env.ASSISTANT_DAILY_LIMIT = '30';
  });

  test('a refusal stop reason sends the refusal event and saves the friendly text', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    nextDeltas = [];
    nextMessage = { stop_reason: 'refusal', usage: { input_tokens: 4, output_tokens: 1, cache_read_input_tokens: 0 } };
    const token = await register('assistant-refusal@test.dev');
    const res = await request(app).post('/api/assistant/chat').set(auth(token)).send({ question: 'Write a political speech' });
    expect(res.status).toBe(200);
    const events = eventsOf(res.text);
    expect(events.map((event) => event.event)).toEqual(['refusal']);
    expect(events[0].data.text).toBe("I can't help with that here. Please ask a scholar or the Haram guidance desk.");

    const me = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const saved = await AssistantConversation.findOne({ userId: me.id, tripId: null });
    expect(saved.messages[1].content).toBe(events[0].data.text);
    expect(saved.messages[1].stopReason).toBe('refusal');
  });
});
