import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useFetch from '../hooks/useFetch';
import { Loading, Section } from '../components/ui';
import { Itinerary } from '../components/trip/OverviewTab';
import PrayerTab from '../components/trip/PrayerTab';
import { formatDate } from '../utils/format';

/** Public, read-only view of a trip shared by its owner. */
export default function SharedTrip() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: trip, loading } = useFetch(`/share/${token}`);

  if (loading) return <Loading />;
  if (!trip) return <div className="card text-center">{t('share.notFound')}</div>;

  const route = trip.stays.map((s) => t(`cities.${s.city}`)).join(' → ');

  return (
    <div className="space-y-5">
      <header className="card border-s-4 border-accent">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">{t('share.title')}</p>
        <h1 className="text-2xl font-bold text-brand">{trip.title || route}</h1>
        <p className="text-sm text-ink-muted">
          {formatDate(trip.startDate, lang)} – {formatDate(trip.endDate, lang)} · {t('dashboard.people', { count: trip.people })}
        </p>
        {trip.completedUmrahs > 0 && <p className="mt-1 text-sm font-semibold text-brand">🤲 {t('dashboard.umrahsDone', { count: trip.completedUmrahs })}</p>}
        <p className="mt-2 text-xs text-ink-muted">{t('share.readOnly')}</p>
      </header>
      <Section title={t('trip.itinerary')}>
        <Itinerary stays={trip.stays} transfers={trip.transfers} lang={lang} />
      </Section>
      <PrayerTab trip={{ _id: token, stays: trip.stays }} />
    </div>
  );
}
