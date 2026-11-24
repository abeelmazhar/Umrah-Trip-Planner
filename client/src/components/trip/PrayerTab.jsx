import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import CrowdBadge from '../CrowdBadge';
import { formatDate, formatHijri, isoDay, nightsBetween } from '../../utils/format';

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** One request per stay: the days you sleep in that city (plus the final check-out day). */
export function cityDays(stays) {
  return stays.map((s, i) => ({
    city: s.city,
    date: isoDay(s.checkIn),
    days: Math.min(31, nightsBetween(s.checkIn, s.checkOut) + (i === stays.length - 1 ? 1 : 0)),
  }));
}

export default function PrayerTab({ trip }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [days, setDays] = useState(null);

  useEffect(() => {
    Promise.all(
      cityDays(trip.stays).map((q) => api.get('/best-times', { params: q }).then((r) => r.data))
    )
      .then((lists) => setDays(lists.flat()))
      .catch(() => setDays([]));
  }, [trip._id, trip.stays]);

  if (!days) return <p className="text-ink-muted">{t('common.loading')}</p>;

  return (
    <section className="card">
      <h2 className="text-lg font-bold">{t('prayer.title')}</h2>
      <p className="mb-4 text-xs text-ink-muted">{t('prayer.method')}</p>
      <div className="space-y-3">
        {days.map((d) => {
          const best = d.windows.find((w) => w.key === d.best);
          return (
            <article key={`${d.city}-${d.date}`} className="rounded-xl p-3 ring-1 ring-brand/10">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-semibold">{formatDate(d.date, lang, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                  <span className="ms-2 text-xs text-ink-muted">{formatHijri(d.date, lang)} · {t('prayer.inCity', { city: t(`cities.${d.city}`) })}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-semibold text-accent-dark">{t(`crowd.reason.${r}`)}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 text-center">
                {PRAYERS.map((p) => (
                  <div key={p} className="rounded-lg bg-surface p-1.5">
                    <div className="text-[11px] text-ink-muted">{t(`prayers.${p}`)}</div>
                    <div dir="ltr" className="font-mono text-sm font-semibold">{d.prayerTimes[p]}</div>
                    <CrowdBadge level={d.prayerCrowd[p]} />
                  </div>
                ))}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-brand">{d.city === 'Makkah' ? `🕋 ${t('prayer.bestTime')}` : `🕌 ${t('prayer.bestVisit')}`}:</span>
                <span>{t(`prayer.windows.${best.key}`)}</span>
                <span dir="ltr" className="font-mono text-xs">{best.from}–{best.to}</span>
                <CrowdBadge level={best.level} />
              </p>
              {d.heatWarning && <p className="mt-1 text-xs text-orange-800">☀️ {t('prayer.heat')}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
