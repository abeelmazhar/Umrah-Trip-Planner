import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import useAssistantChat from '../hooks/useAssistantChat';
import { Alert, Loading } from '../components/ui';
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

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [params, setParams] = useSearchParams();
  const { data: trips, loading: tripsLoading } = useFetch('/trips');
  const urlTrip = params.get('trip');
  const [tripId, setTripId] = useState(urlTrip === null ? undefined : urlTrip);
  const [input, setInput] = useState('');
  const [votes, setVotes] = useState({});
  const [voteError, setVoteError] = useState('');
  const chat = useAssistantChat(tripId, i18n.resolvedLanguage || i18n.language);
  const { messages, send, stop, clear, streaming, error, usedToday, dailyLimit, enabled } = chat;
  const left = Math.max(0, dailyLimit - usedToday);

  useEffect(() => {
    if (tripId !== undefined || tripsLoading) return;
    const id = defaultTripId(trips);
    setTripId(id);
    if (id) setParams({ trip: id }, { replace: true });
  }, [tripId, trips, tripsLoading, setParams]);

  const chooseTrip = (id) => {
    setTripId(id);
    setVotes({});
    if (id) setParams({ trip: id }, { replace: true });
    else setParams({}, { replace: true });
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
    <div className="space-y-4">
      <Alert kind="warning">{t('assistant.disclaimer')}</Alert>
      {enabled === null && <Loading />}
      {enabled === false && <Alert kind="info">{t('assistant.unavailable')}</Alert>}
      {error && <Alert>{error}</Alert>}
      {voteError && <Alert>{voteError}</Alert>}

      {enabled && (
        <>
          <section className="card space-y-3">
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
            <p className="text-xs text-ink-muted">{t('assistant.left', { left, limit: dailyLimit })}</p>
          </section>

          <section className="card space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="btn-secondary"
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
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                      message.role === 'user' ? 'bg-brand text-white' : 'bg-brand-light text-ink'
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
            </div>

            <form onSubmit={submit} className="space-y-2">
              <label className="label" htmlFor="assistant-question">{t('assistant.question')}</label>
              <textarea
                id="assistant-question"
                className="input min-h-24"
                maxLength={1000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t('assistant.placeholder')}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-muted">{input.length}/1000</span>
                <span className="ms-auto" />
                <button type="button" className="btn-secondary" onClick={clear} disabled={streaming || messages.length === 0}>
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
          </section>
        </>
      )}
    </div>
  );
}
