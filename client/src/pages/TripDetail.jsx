import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import OverviewTab from '../components/trip/OverviewTab';
import PrayerTab from '../components/trip/PrayerTab';
import GuideTab from '../components/trip/GuideTab';
import BudgetTab from '../components/trip/BudgetTab';
import TravellersTab from '../components/trip/TravellersTab';
import ChecklistTab from '../components/trip/ChecklistTab';
import { formatDate, formatMoney, formatSAR } from '../utils/format';

const TABS = ['overview', 'prayer', 'guide', 'budget', 'travellers', 'checklist'];

export default function TripDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'overview';
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const lang = i18n.language;

  useEffect(() => {
    api
      .get(`/trips/${id}`)
      .then((res) => setTrip(res.data))
      .catch((err) => setError(err.response?.status === 404 ? t('trip.notFound') : errorMessage(err, t('common.error'))));
  }, [id, t]);

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

  const { insights } = trip;
  const docErrors = insights.documents.issues.filter((i) => i.severity === 'error').length;
  const props = { trip, setTrip, setError };

  return (
    <div className="space-y-5">
      <header className="card flex flex-wrap items-center gap-4 border-s-4 border-accent">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">
            {insights.route.map((c) => t(`cities.${c}`)).join(' → ')}
          </p>
          <h1 className="text-2xl font-bold text-brand">{trip.title || insights.route.map((c) => t(`cities.${c}`)).join(' → ')}</h1>
          <p className="text-sm text-ink-muted">
            {formatDate(trip.startDate, lang)} – {formatDate(trip.endDate, lang)} · {t('dashboard.nights', { count: insights.nights })} ·{' '}
            {t('dashboard.people', { count: trip.people })}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-ink-muted">{t('trip.totalCost')}</p>
          <p className="text-2xl font-bold text-brand">{formatSAR(trip.totalCostSAR, lang)}</p>
          {insights.homeCurrency.code !== 'SAR' && (
            <p className="text-sm text-ink-muted">≈ {formatMoney(insights.homeCurrency.totalCost, insights.homeCurrency.code, lang)}</p>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <nav role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((key) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setParams({ tab: key }, { replace: true })}
            className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-brand/15 hover:bg-brand-light'}`}>
            {t(`trip.tabs.${key}`)}
            {key === 'travellers' && docErrors > 0 && (
              <span className="ms-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs text-white">{docErrors}</span>
            )}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab {...props} />}
        {tab === 'prayer' && <PrayerTab {...props} />}
        {tab === 'guide' && <GuideTab {...props} />}
        {tab === 'budget' && <BudgetTab {...props} />}
        {tab === 'travellers' && <TravellersTab {...props} />}
        {tab === 'checklist' && <ChecklistTab {...props} />}
      </div>

      <div className="flex justify-between">
        <Link to="/" className="btn-secondary">{t('common.back')}</Link>
        <button type="button" onClick={remove} className="btn-danger">{t('trip.delete')}</button>
      </div>
    </div>
  );
}
