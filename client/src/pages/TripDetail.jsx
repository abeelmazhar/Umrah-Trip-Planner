import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import { Alert, Loading } from '../components/ui';
import Tabs from '../components/Tabs';
import OverviewTab from '../components/trip/OverviewTab';
import PrayerTab from '../components/trip/PrayerTab';
import GuideTab from '../components/trip/GuideTab';
import BudgetTab from '../components/trip/BudgetTab';
import TravellersTab from '../components/trip/TravellersTab';
import ChecklistTab from '../components/trip/ChecklistTab';
import { formatDate, formatMoney, formatSAR } from '../utils/format';

const TABS = {
  overview: OverviewTab,
  prayer: PrayerTab,
  guide: GuideTab,
  budget: BudgetTab,
  travellers: TravellersTab,
  checklist: ChecklistTab,
};

export default function TripDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'overview';
  const { data: trip, setData: setTrip, error, setError, status, loading } = useFetch(`/trips/${id}`);

  const remove = async () => {
    if (!window.confirm(t('dashboard.confirmDelete'))) return;
    try {
      await api.delete(`/trips/${id}`);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
    }
  };

  if (loading) return <Loading />;
  if (!trip) {
    return (
      <div className="card text-center">
        <p className="mb-4">{status === 404 ? t('trip.notFound') : error}</p>
        <Link to="/" className="btn-secondary">{t('common.back')}</Link>
      </div>
    );
  }

  const { insights } = trip;
  const route = insights.route.map((c) => t(`cities.${c}`)).join(' → ');
  const docErrors = insights.documents.issues.filter((i) => i.severity === 'error').length;
  const TabPanel = TABS[tab];

  return (
    <div className="space-y-5">
      <header className="card flex flex-wrap items-center gap-4 border-s-4 border-accent">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">{route}</p>
          <h1 className="text-2xl font-bold text-brand">{trip.title || route}</h1>
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

      <Alert>{error}</Alert>

      <Tabs
        tabs={Object.keys(TABS).map((key) => ({ key, label: t(`trip.tabs.${key}`), badge: key === 'travellers' ? docErrors : 0 }))}
        active={tab}
        onChange={(key) => setParams({ tab: key }, { replace: true })}
      />
      <div role="tabpanel">
        <TabPanel trip={trip} setTrip={setTrip} setError={setError} />
      </div>

      <div className="flex justify-between">
        <Link to="/" className="btn-secondary">{t('common.back')}</Link>
        <button type="button" onClick={remove} className="btn-danger">{t('trip.delete')}</button>
      </div>
    </div>
  );
}
