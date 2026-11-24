import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatSAR, nightsBetween } from '../utils/format';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/trips')
      .then((res) => setTrips(res.data))
      .catch((err) => setError(errorMessage(err, t('common.error'))));
  }, [t]);

  const remove = async (id) => {
    if (!window.confirm(t('dashboard.confirmDelete'))) return;
    try {
      await api.delete(`/trips/${id}`);
      setTrips((list) => list.filter((trip) => trip._id !== id));
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
    }
  };

  const lang = i18n.language;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{t('dashboard.greeting', { name: user?.name })}</p>
          <h1 className="text-3xl font-bold text-brand">{t('dashboard.title')}</h1>
        </div>
        <Link to="/trips/new" className="btn-primary">+ {t('nav.newTrip')}</Link>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!trips && !error && <p className="text-ink-muted">{t('common.loading')}</p>}

      {trips?.length === 0 && (
        <div className="card text-center">
          <p className="mb-4 text-ink-muted">{t('dashboard.empty')}</p>
          <Link to="/trips/new" className="btn-primary">{t('dashboard.emptyCta')}</Link>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {trips?.map((trip) => {
          const done = trip.checklist.filter((i) => i.done).length;
          const total = trip.checklist.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li key={trip._id} className="card flex flex-col gap-3 border-s-4 border-accent">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t(`cities.${trip.city}`)}</p>
                  <h2 className="text-lg font-bold">{trip.hotelId?.name}</h2>
                </div>
                <p className="whitespace-nowrap text-end font-bold text-brand">{formatSAR(trip.totalCostSAR, lang)}</p>
              </div>
              <p className="text-sm text-ink-muted">
                {formatDate(trip.startDate, lang)} – {formatDate(trip.endDate, lang)} ·{' '}
                {t('dashboard.nights', { count: nightsBetween(trip.startDate, trip.endDate) })} ·{' '}
                {t('dashboard.people', { count: trip.people })}
              </p>
              <div>
                <div className="mb-1 text-xs text-ink-muted">{t('dashboard.progress', { done, total })}</div>
                <div className="h-2 overflow-hidden rounded-full bg-brand-light">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Link to={`/trips/${trip._id}`} className="btn-secondary flex-1">{t('dashboard.view')}</Link>
                <button type="button" onClick={() => remove(trip._id)} className="btn-danger">{t('common.delete')}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
