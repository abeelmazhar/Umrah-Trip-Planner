import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import { Alert, Loading } from '../components/ui';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { daysUntil, formatDate, formatMoney, formatSAR } from '../utils/format';

const FEATURES = [
  ['🗺️', 'itinerary'],
  ['🕌', 'prayer'],
  ['🕋', 'guide'],
  ['💰', 'budget'],
  ['🛂', 'docs'],
  ['👨‍👩‍👧', 'share'],
  ['🧭', 'group'],
];

function Countdown({ trip }) {
  const { t } = useTranslation();
  const start = daysUntil(trip.startDate);
  const end = daysUntil(trip.endDate);
  let text;
  let cls = 'bg-brand-light text-brand';
  if (start > 0) text = t('dashboard.inDays', { count: start });
  else if (start === 0) text = t('dashboard.today');
  else if (end >= 0) {
    text = t('dashboard.ongoing');
    cls = 'bg-accent text-brand-dark';
  } else {
    text = t('dashboard.past');
    cls = 'bg-black/5 text-ink-muted';
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: trips, setData: setTrips, error, setError, loading } = useFetch('/trips');
  const lang = i18n.language;


  const remove = async (id) => {
    if (!window.confirm(t('dashboard.confirmDelete'))) return;
    try {
      await api.delete(`/trips/${id}`);
      setTrips((list) => list.filter((trip) => trip._id !== id));
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{t('dashboard.greeting', { name: user?.name })}</p>
          <h1 className="text-2xl font-bold text-brand sm:text-3xl">{t('dashboard.title')}</h1>
        </div>
        <Link to="/trips/new" className="btn-gold"><Icon name="plus" className="h-4 w-4" />{t('nav.newTrip')}</Link>
      </div>

      <Alert>{error}</Alert>
      {loading && <Loading title={false} />}

      {trips?.length === 0 && (
        <div className="card">
          <h2 className="mb-4 text-center text-lg font-bold text-brand">{t('dashboard.features.title')}</h2>
          <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([icon, key]) => (
              <li key={key} className="flex items-start gap-3 rounded-xl bg-brand-light p-3 text-sm">
                <span className="text-xl" aria-hidden="true">{icon}</span>
                {t(`dashboard.features.${key}`)}
              </li>
            ))}
          </ul>
          <p className="mb-3 text-center text-ink-muted">{t('dashboard.empty')}</p>
          <div className="text-center">
            <Link to="/trips/new" className="btn-primary">{t('dashboard.emptyCta')}</Link>
          </div>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {trips?.map((trip) => {
          const { insights } = trip;
          const done = trip.checklist.filter((i) => i.done).length;
          const total = trip.checklist.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const docErrors = insights.documents.issues.filter((i) => i.severity === 'error').length;
          const route = insights.route.map((c) => t(`cities.${c}`)).join(' → ');
          return (
            <li key={trip._id} className="card flex flex-col gap-3 border-s-4 border-accent">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Countdown trip={trip} />
                    {docErrors > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">⛔ {t('dashboard.docIssues', { count: docErrors })}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold">{trip.title || route}</h2>
                  {trip.title && <p className="text-xs font-semibold text-accent-dark">{route}</p>}
                </div>
                <div className="text-end">
                  <p className="whitespace-nowrap font-bold text-brand">{formatSAR(trip.totalCostSAR, lang)}</p>
                  {insights.homeCurrency.code !== 'SAR' && (
                    <p className="whitespace-nowrap text-xs text-ink-muted">≈ {formatMoney(insights.homeCurrency.totalCost, insights.homeCurrency.code, lang)}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-ink-muted">
                {formatDate(trip.startDate, lang)} – {formatDate(trip.endDate, lang)} · {t('dashboard.nights', { count: insights.nights })} ·{' '}
                {t('dashboard.people', { count: trip.people })}
              </p>
              {trip.ritual?.completedUmrahs > 0 && (
                <p className="text-sm font-semibold text-brand">🤲 {t('dashboard.umrahsDone', { count: trip.ritual.completedUmrahs })}</p>
              )}
              <div>
                <div className="mb-1 text-xs text-ink-muted">{t('dashboard.progress', { done, total })}</div>
                <div className="h-2 overflow-hidden rounded-full bg-brand-light">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Link to={`/trips/${trip._id}`} className="btn-secondary flex-1">{t('dashboard.view')}</Link>
                <button type="button" onClick={() => remove(trip._id)} className="btn-danger !px-3" aria-label={t('common.delete')} title={t('common.delete')}>
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
