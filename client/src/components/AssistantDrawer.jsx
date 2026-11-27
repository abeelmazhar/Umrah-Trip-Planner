import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import useAssistantChat from '../hooks/useAssistantChat';
import { useAssistantDrawer } from '../context/AssistantDrawerContext';
import { Alert, CardSkeleton } from './ui';
import Icon from './Icon';
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
  const inputRef = useRef(null);
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

  useEffect(() => {
    if (open && enabled) inputRef.current?.focus();
  }, [open, enabled]);

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
    if (inputRef.current) inputRef.current.style.height = 'auto';
    send(question);
  };

  const onInput = (event) => {
    setInput(event.target.value);
    const field = event.target;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="no-print fixed inset-0 z-40 bg-black/40"
          aria-label={t('assistant.close')}
          onClick={closeDrawer}
        />
      )}
      <aside
        className={`no-print fixed top-0 end-0 z-50 flex h-full w-full max-w-md flex-col bg-[#f3f0e8] shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full rtl:-translate-x-full'
        }`}
        aria-hidden={!open}
        inert={!open}
        aria-label={t('nav.assistant')}
      >
        <header className="flex items-center gap-3 bg-brand px-3 py-3 text-white">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
            <Icon name="chat" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">{t('nav.assistant')}</h2>
            {enabled && (
              <p className="truncate text-xs text-white/75">{t('assistant.left', { left, limit: dailyLimit })}</p>
            )}
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-white/90 hover:bg-white/10 disabled:opacity-40"
            onClick={clear}
            disabled={streaming || messages.length === 0}
            aria-label={t('assistant.clear')}
            title={t('assistant.clear')}
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-full p-2 text-white/90 hover:bg-white/10" onClick={closeDrawer} aria-label={t('assistant.close')} title={t('assistant.close')}>
            <Icon name="close" />
          </button>
        </header>

        {enabled && (
          <div className="border-b border-brand/10 bg-white px-3 py-2">
            <label className="sr-only" htmlFor="assistant-trip">{t('assistant.trip')}</label>
            <select
              id="assistant-trip"
              className="w-full bg-transparent text-sm font-medium text-ink outline-none"
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
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {open && enabled === null && <CardSkeleton lines={4} />}
          {enabled === false && <Alert kind="info">{t('assistant.unavailable')}</Alert>}
          {error && <Alert>{error}</Alert>}
          {voteError && <Alert>{voteError}</Alert>}

          {enabled && messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center px-2 pt-6 text-center">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand text-white">
                <Icon name="chat" className="h-7 w-7" />
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="max-w-full rounded-full bg-white px-3 py-2 text-start text-xs text-ink ring-1 ring-brand/15 hover:bg-brand-light disabled:opacity-50"
                    onClick={() => send(t(`assistant.suggestions.${key}`))}
                    disabled={left === 0}
                  >
                    {t(`assistant.suggestions.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {enabled && messages.map((message, index) => {
            const mine = message.role === 'user';
            return (
              <div key={`${message.role}-${index}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  <div
                    dir="auto"
                    className={`whitespace-pre-wrap px-3 py-2 text-sm shadow-sm ${
                      mine
                        ? 'rounded-2xl rounded-ee-md bg-brand text-white'
                        : 'rounded-2xl rounded-es-md bg-white text-ink'
                    }`}
                  >
                    {message.content}
                    {!mine && !message.settled && !message.content && <Typing />}
                    {!mine && !message.settled && message.content && <span className="ms-0.5 inline-block animate-pulse">▍</span>}
                  </div>
                  {!mine && message.settled && message.content && (
                    <div className="mt-1 flex items-center gap-1 text-ink-muted">
                      {message.truncated && <span className="text-[11px]">{t('assistant.truncated')}</span>}
                      <button type="button" className={`rounded-full p-1 ${votes[index] === 'up' ? 'bg-brand-light text-brand' : 'hover:bg-white'}`} aria-label={t('assistant.helpful')} title={t('assistant.helpful')} onClick={() => rate(index, 'up')}>
                        <Icon name="thumbUp" className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className={`rounded-full p-1 ${votes[index] === 'down' ? 'bg-red-50 text-red-700' : 'hover:bg-white'}`} aria-label={t('assistant.notHelpful')} title={t('assistant.notHelpful')} onClick={() => rate(index, 'down')}>
                        <Icon name="thumbDown" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {enabled && (
          <form
            onSubmit={submit}
            className="border-t border-brand/10 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-end gap-2 rounded-3xl bg-[#f3f0e8] px-2 py-1.5">
              <label className="sr-only" htmlFor="assistant-question">{t('assistant.question')}</label>
              <textarea
                id="assistant-question"
                ref={inputRef}
                rows={1}
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                maxLength={1000}
                value={input}
                onChange={onInput}
                onKeyDown={onKeyDown}
                placeholder={t('assistant.placeholder')}
                disabled={left === 0}
              />
              {streaming ? (
                <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-700 text-white" onClick={stop} aria-label={t('assistant.stop')} title={t('assistant.stop')}>
                  <Icon name="stop" className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40" disabled={input.trim().length < 2 || left === 0} aria-label={t('assistant.send')} title={t('assistant.send')}>
                  <Icon name="send" className="h-4 w-4" mirror />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[11px] leading-snug text-ink-muted">{t('assistant.disclaimer')}</p>
          </form>
        )}
      </aside>
    </>
  );
}

function Typing() {
  return (
    <span className="flex h-5 items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted" />
    </span>
  );
}
