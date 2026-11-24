import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import CrowdBadge from '../components/CrowdBadge';
import { daysBetween, formatDate, formatSAR, nightsBetween } from '../utils/format';

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const MAX_CROWD_DAYS = 14;

function CrowdTable({ trip }) {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(null);
  const allDays = daysBetween(trip.startDate, trip.endDate, 60);
  const shown = allDays.slice(0, MAX_CROWD_DAYS);

  useEffect(() => {
    Promise.all(shown.map((date) => api.get('/crowd', { params: { date } }).then((r) => r.data)))
      .then(setDays)
      .catch(() => setDays([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip._id]);

  if (!days) return <p className="text-ink-muted">{t('common.loading')}</p>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-muted">
              <th className="py-2 pe-3 text-start font-medium" />
              {PRAYERS.map((p) => (
                <th key={p} className="px-1 py-2 text-center font-medium">{t(`prayers.${p}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {days.map((d) => (
              <tr key={d.date}>
                <td className="py-2 pe-3 whitespace-nowrap">
                  <div className="font-medium">{formatDate(d.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  <div className="flex flex-wrap gap-1">
                    {d.reasons.map((r) => (
                      <span key={r} className="text-[10px] font-semibold uppercase text-accent">{t(`crowd.reason.${r}`)}</span>
                    ))}
                  </div>
                </td>
                {PRAYERS.map((p) => (
                  <td key={p} className="px-1 py-2 text-center">
                    <CrowdBadge level={d.prayers[p]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allDays.length > MAX_CROWD_DAYS && (
        <p className="mt-2 text-xs text-ink-muted">{t('trip.moreDays', { count: MAX_CROWD_DAYS })}</p>
      )}
      <p className="mt-3 text-xs text-ink-muted">{t('trip.crowdNote')}</p>
    </div>
  );
}

export default function TripDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const lang = i18n.language;

  useEffect(() => {
    api
      .get(`/trips/${id}`)
      .then((res) => setTrip(res.data))
      .catch((err) => setError(err.response?.status === 404 ? t('trip.notFound') : errorMessage(err, t('common.error'))));
  }, [id, t]);

  const toggle = async (item) => {
    const next = !item.done;
    // optimistic update
    setTrip((tr) => ({ ...tr, checklist: tr.checklist.map((i) => (i._id === item._id ? { ...i, done: next } : i)) }));
    try {
      await api.patch(`/trips/${id}/checklist/${item._id}`, { done: next });
    } catch (err) {
      setTrip((tr) => ({ ...tr, checklist: tr.checklist.map((i) => (i._id === item._id ? { ...i, done: !next } : i)) }));
      setError(errorMessage(err, t('common.error')));
    }
  };

  const remove = async () => {
    if (!window.confirm(t('dashboard.confirmDelete'))) return;
    try {
      await api.delete(`/trips/${id}`);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
    }
  };

  if (error && !trip) {
    return (
      <div className="card text-center">
        <p className="mb-4">{error}</p>
        <Link to="/" className="btn-secondary">{t('common.back')}</Link>
      </div>
    );
  }
  if (!trip) return <p className="text-ink-muted">{t('common.loading')}</p>;

  const done = trip.checklist.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-4 border-s-4 border-accent">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t(`cities.${trip.city}`)}</p>
          <h1 className="text-2xl font-bold text-brand">{trip.hotelId?.name}</h1>
          <p className="text-sm text-ink-muted">
            {formatDate(trip.startDate, lang)} – {formatDate(trip.endDate, lang)} ·{' '}
            {t('dashboard.nights', { count: nightsBetween(trip.startDate, trip.endDate) })} ·{' '}
            {t('dashboard.people', { count: trip.people })}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-ink-muted">{t('trip.totalCost')}</p>
          <p className="text-2xl font-bold text-brand">{formatSAR(trip.totalCostSAR, lang)}</p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t('trip.checklist')}</h2>
            <span className="text-sm text-ink-muted">{t('dashboard.progress', { done, total: trip.checklist.length })}</span>
          </div>
          <ul className="space-y-1">
            {trip.checklist.map((item) => (
              <li key={item._id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-brand-light">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggle(item)}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                  <span className={item.done ? 'text-ink-muted line-through' : ''}>
                    {t(`checklist.${item.title}`, { defaultValue: item.title })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="card lg:col-span-3">
          <h2 className="mb-3 text-lg font-bold">{t('trip.crowd')}</h2>
          <CrowdTable trip={trip} />
        </section>
      </div>

      <div className="flex justify-between">
        <Link to="/" className="btn-secondary">{t('common.back')}</Link>
        <button type="button" onClick={remove} className="btn-danger">{t('trip.delete')}</button>
      </div>
    </div>
  );
}
