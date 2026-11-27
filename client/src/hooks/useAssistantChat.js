import { useCallback, useEffect, useRef, useState } from 'react';
import api, { TOKEN_KEY } from '../api/client';

const API_ROOT = `${import.meta.env.VITE_API_URL || ''}/api`;

function parseSseBlock(block) {
  let event = 'message';
  const dataLines = [];
  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  });
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

export default function useAssistantChat(tripId, language) {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [usedToday, setUsedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [enabled, setEnabled] = useState(null);
  const abortRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (tripId === undefined) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setError('');
    setMessages([]);
    try {
      const status = await api.get('/assistant/status');
      setEnabled(Boolean(status.data.enabled));
      setDailyLimit(status.data.dailyLimit ?? 30);
      setUsedToday(status.data.usedToday ?? 0);
      const history = await api.get('/assistant/conversation', { params: tripId ? { tripId } : {} });
      const stored = Array.isArray(history.data.messages) ? history.data.messages : [];
      if (requestRef.current !== requestId) return;
      setMessages(stored.map((message) => ({ ...message, settled: true })));
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err?.response?.data?.message || err?.message || 'Something went wrong');
    }
  }, [tripId]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async (question) => {
    const text = String(question || '').trim();
    if (!text || streaming) return;
    setError('');
    setStreaming(true);
    setMessages((current) => [
      ...current,
      { role: 'user', content: text, settled: true },
      { role: 'assistant', content: '', settled: false },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    const append = (chunk) => {
      setMessages((current) => {
        if (!current.length) return current;
        const next = current.slice();
        const last = { ...next[next.length - 1] };
        last.content = `${last.content}${chunk}`;
        next[next.length - 1] = last;
        return next;
      });
    };
    const settle = (patch) => {
      setMessages((current) => {
        if (!current.length) return current;
        const next = current.slice();
        next[next.length - 1] = { ...next[next.length - 1], ...patch, settled: true };
        return next;
      });
    };

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const response = await fetch(`${API_ROOT}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: text, tripId: tripId || undefined, language }),
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('text/event-stream')) {
        let message = 'Something went wrong';
        try {
          const body = await response.json();
          message = body.message || message;
        } catch {
          /* the body was not JSON */
        }
        setMessages((current) => current.slice(0, -2));
        setError(message);
        return;
      }

      setUsedToday((count) => count + 1);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';
        blocks.forEach((block) => {
          const parsed = parseSseBlock(block);
          if (!parsed) return;
          if (parsed.event === 'delta') append(parsed.data.text || '');
          else if (parsed.event === 'refusal') settle({ content: parsed.data.text || '', stopReason: 'refusal' });
          else if (parsed.event === 'done') settle({ stopReason: parsed.data.stopReason, truncated: Boolean(parsed.data.truncated) });
          else if (parsed.event === 'error') {
            settle({ stopReason: 'error' });
            setError(parsed.data.message || 'Something went wrong');
          }
        });
      }
      settle({});
    } catch (err) {
      if (err?.name === 'AbortError') {
        settle({ stopReason: 'aborted' });
      } else {
        setError(err?.message || 'Something went wrong');
        settle({ stopReason: 'error' });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [language, streaming, tripId]);

  const clear = useCallback(async () => {
    abortRef.current?.abort();
    setError('');
    try {
      await api.delete('/assistant/conversation', { params: tripId ? { tripId } : {} });
      setMessages([]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Something went wrong');
    }
  }, [tripId]);

  return { messages, send, stop, clear, streaming, error, usedToday, dailyLimit, enabled };
}
