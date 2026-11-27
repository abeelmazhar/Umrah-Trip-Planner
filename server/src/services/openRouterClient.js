/**
 * Streams a chat completion from OpenRouter.
 * Tests replace `streamAnswer` on this object. No key is logged.
 */
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

class APIUserAbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'APIUserAbortError';
  }
}

function mapStop(finish) {
  if (finish === 'length') return 'max_tokens';
  if (finish === 'refusal' || finish === 'content_filter') return 'refusal';
  return 'end_turn';
}

function emitData(block, listeners, state) {
  const line = block.split('\n').find((item) => item.startsWith('data:'));
  if (!line) return;
  const raw = line.slice(5).trim();
  if (!raw || raw === '[DONE]') return;
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }
  if (json.error) {
    const err = new Error('OpenRouter request failed');
    err.status = Number(json.error.code) || 502;
    throw err;
  }
  const choice = json.choices && json.choices[0];
  const piece = choice?.delta?.content;
  if (typeof piece === 'string' && piece) {
    state.text += piece;
    listeners.forEach((cb) => cb(piece));
  }
  const native = choice?.native_finish_reason;
  if (native === 'refusal' || choice?.finish_reason === 'content_filter') state.finish = 'refusal';
  else if (choice?.finish_reason) state.finish = choice.finish_reason;
  if (json.usage) state.usage = json.usage;
}

function streamAnswer(params) {
  const listeners = [];
  const controller = new AbortController();
  let aborted = false;
  let resolveMessage;
  let rejectMessage;
  const done = new Promise((resolve, reject) => {
    resolveMessage = resolve;
    rejectMessage = reject;
  });

  const fail = (err) => {
    if (aborted || err?.name === 'AbortError') {
      rejectMessage(new APIUserAbortError());
      return;
    }
    rejectMessage(err);
  };

  (async () => {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_ORIGIN || 'https://umrah-trip-planner.vercel.app',
          'X-Title': 'Umrah Trip Planner',
        },
        body: JSON.stringify({ ...params, stream: true, stream_options: { include_usage: true } }),
        signal: controller.signal,
      });
    } catch (err) {
      fail(err);
      return;
    }

    if (!response.ok || !response.body) {
      const err = new Error('OpenRouter request failed');
      err.status = response.status;
      fail(err);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state = { text: '', finish: 'stop', usage: null };
    let buffer = '';
    try {
      while (true) {
        const { value, done: ended } = await reader.read();
        if (ended) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';
        blocks.forEach((block) => emitData(block, listeners, state));
      }
    } catch (err) {
      fail(err);
      return;
    }

    const usage = state.usage || {};
    resolveMessage({
      stop_reason: mapStop(state.finish),
      content: state.text ? [{ type: 'text', text: state.text }] : [],
      usage: {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        cache_read_input_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
      },
    });
  })();

  return {
    on(event, cb) {
      if (event === 'text') listeners.push(cb);
      return this;
    },
    abort() {
      aborted = true;
      controller.abort();
    },
    finalMessage() {
      return done;
    },
  };
}

module.exports = { streamAnswer, APIUserAbortError };
