import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { Itinerary } from '../components/trip/OverviewTab';
import PrayerTab from '../components/trip/PrayerTab';
import { formatDate } from '../utils/format';

/** Public, read-only view of a trip shared by its owner. */
export default function SharedTrip() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [trip, setTrip] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/share/${token}`).then((r) => setTrip(r.data)).catch(() => setMissing(true));
  }, [token]);

  if (missing) return <div className="card text-center">{t('share.notFound')}</div>;
  if (!trip) return <p className="text-ink-muted">{t('common.loading')}</p>;

  const route = trip.stays.map((s) => t(`cities.${s.city}`)).join(' → ');
  const lang = i18n.language;

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
      <section className="card">
        <h2 className="mb-4 text-lg font-bold">{t('trip.itinerary')}</h2>
        <Itinerary stays={trip.stays} transfers={trip.transfers} lang={lang} />
      </section>
      <PrayerTab trip={{ _id: token, stays: trip.stays }} />
    </div>
  );
}
