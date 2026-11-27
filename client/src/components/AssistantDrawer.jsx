import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import useAssistantChat from '../hooks/useAssistantChat';
import { useAssistantDrawer } from '../context/AssistantDrawerContext';
import { Alert, CardSkeleton } from './ui';
import { formatDate } from '../utils/format';

const SUGGESTIONS = ['wudu', 'quba', 'fajr', 'miqat', 'ihram'];

function defaultTripId(trips) {
  if (!Array.isArray(trips) || !trips.length) return '';
  const today = new Date();
  const current = trips.find((trip) => new Date(trip.startDate) <= today && today <= new Date(trip.endDate));
  if (current) return current._id;
  const upcoming = trips.find((trip) => new Date(trip.startDate) > today);
  return (upcoming || trips[trips.length - 1])._id;
}

export default function AssistantDrawer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { open, tripRequest, closeDrawer } = useAssistantDrawer();
  const { data: trips, loading: tripsLoading } = useFetch(open ? '/trips' : null);
  const [tripId, setTripId] = useState(undefined);
  const [input, setInput] = useState('');
  const [votes, setVotes] = useState({});
  const [voteError, setVoteError] = useState('');
  const bottomRef = useRef(null);
  const chat = useAssistantChat(open ? tripId : undefined, i18n.resolvedLanguage || i18n.language);
  const { messages, send, stop, clear, streaming, error, usedToday, dailyLimit, enabled } = chat;
  const left = Math.max(0, dailyLimit - usedToday);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (!open || tripsLoading) return;
    if (tripRequest?.tripId) {
      setTripId(tripRequest.tripId);
      return;
    }
    setTripId((current) => (current === undefined ? defaultTripId(trips) : current));
  }, [open, tripRequest, trips, tripsLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming, open]);

  const chooseTrip = (id) => {
    setTripId(id);
    setVotes({});
  };

  const rate = async (messageIndex, rating) => {
    setVoteError('');
    setVotes((current) => ({ ...current, [messageIndex]: rating }));
    try {
      await api.post('/assistant/feedback', { tripId: tripId || undefined, messageIndex, rating });
    } catch (err) {
      setVoteError(errorMessage(err));
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (input.trim().length < 2 || streaming || left === 0) return;
    const question = input;
    setInput('');
    send(question);
  };

  return (
    <aside
      className={`no-print fixed top-0 end-0 z-50 flex h-full w-full max-w-md flex-col border-s border-brand/10 bg-surface shadow-2xl transition-transform duration-200 ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full rtl:-translate-x-full'
      }`}
      aria-hidden={!open}
      inert={!open}
      aria-label={t('nav.assistant')}
    >
      <header className="flex items-center gap-3 border-b border-brand/10 bg-brand px-4 py-3 text-white">
        <h2 className="flex-1 text-base font-bold">{t('nav.assistant')}</h2>
        <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-white/90 hover:bg-white/10" onClick={closeDrawer}>
          {t('assistant.close')}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <Alert kind="warning">{t('assistant.disclaimer')}</Alert>
        {open && enabled === null && <CardSkeleton lines={4} />}
        {enabled === false && <Alert kind="info">{t('assistant.unavailable')}</Alert>}
        {error && <Alert>{error}</Alert>}
        {voteError && <Alert>{voteError}</Alert>}

        {enabled && (
          <>
            <div>
              <label className="label" htmlFor="assistant-trip">{t('assistant.trip')}</label>
              <select
                id="assistant-trip"
                className="input"
                value={tripId || ''}
                onChange={(event) => chooseTrip(event.target.value)}
              >
                <option value="">{t('assistant.noTrip')}</option>
                {Array.isArray(trips) && trips.map((trip) => (
                  <option key={trip._id} value={trip._id}>
                    {(trip.title || t('assistant.untitled'))} · {formatDate(trip.startDate, lang)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">{t('assistant.left', { left, limit: dailyLimit })}</p>
            </div>

            {messages.length === 0 && !streaming && (
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="btn-secondary w-full text-start text-xs"
                    onClick={() => send(t(`assistant.suggestions.${key}`))}
                    disabled={left === 0}
                  >
                    {t(`assistant.suggestions.${key}`)}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ms-auto max-w-[85%]' : 'me-auto max-w-[85%]'}>
                  <div
                    dir="auto"
                    className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      message.role === 'user' ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-brand/10'
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === 'assistant' && message.settled && message.content && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <span>{t('assistant.mayBeWrong')}</span>
                      {message.truncated && <span>{t('assistant.truncated')}</span>}
                      <button type="button" className={votes[index] === 'up' ? 'font-bold' : ''} aria-label={t('assistant.helpful')} onClick={() => rate(index, 'up')}>
                        👍
                      </button>
                      <button type="button" className={votes[index] === 'down' ? 'font-bold' : ''} aria-label={t('assistant.notHelpful')} onClick={() => rate(index, 'down')}>
                        👎
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </div>

      {enabled && (
        <form onSubmit={submit} className="space-y-2 border-t border-brand/10 bg-white px-4 py-3">
          <label className="sr-only" htmlFor="assistant-question">{t('assistant.question')}</label>
          <textarea
            id="assistant-question"
            className="input min-h-20"
            maxLength={1000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('assistant.placeholder')}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted">{input.length}/1000</span>
            <button type="button" className="btn-secondary ms-auto" onClick={clear} disabled={streaming || messages.length === 0}>
              {t('assistant.clear')}
            </button>
            {streaming ? (
              <button type="button" className="btn-danger" onClick={stop}>{t('assistant.stop')}</button>
            ) : (
              <button type="submit" className="btn-primary" disabled={input.trim().length < 2 || left === 0}>
                {t('assistant.send')}
              </button>
            )}
          </div>
        </form>
      )}
    </aside>
  );
}
