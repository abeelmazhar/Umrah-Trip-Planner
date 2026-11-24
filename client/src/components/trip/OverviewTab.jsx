import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';
import MiqatCard from '../MiqatCard';
import { formatDate, formatMoney, formatSAR } from '../../utils/format';

const MODE_ICON = { train: '🚄', bus: '🚌', taxi: '🚗' };

export function Itinerary({ stays, transfers, lang }) {
  const { t } = useTranslation();
  const items = [];
  stays.forEach((s, i) => {
    items.push({ kind: 'stay', s, i });
    const tr = transfers.find((x) => new Date(x.date).getTime() === new Date(stays[i + 1]?.checkIn).getTime() && x.from === s.city);
    if (tr) items.push({ kind: 'transfer', tr });
  });
  return (
    <ol className="relative space-y-3 border-s-2 border-brand/20 ps-5">
      {items.map((it, k) =>
        it.kind === 'stay' ? (
          <li key={k} className="relative">
            <span className="absolute -start-[1.72rem] top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] text-white">{it.i + 1}</span>
            <p className="font-semibold text-brand">{t(`cities.${it.s.city}`)} · {t('dashboard.nights', { count: it.s.nights })}</p>
            <p className="text-sm">{it.s.hotelId?.name || it.s.hotel?.name}</p>
            <p className="text-xs text-ink-muted">
              {formatDate(it.s.checkIn, lang, { weekday: 'short', day: 'numeric', month: 'short' })} → {formatDate(it.s.checkOut, lang, { weekday: 'short', day: 'numeric', month: 'short' })}
              {(it.s.hotelId?.distanceToHaramM ?? it.s.hotel?.distanceToHaramM) !== undefined &&
                ` · ${t('wizard.fromHaram', { distance: (it.s.hotelId?.distanceToHaramM ?? it.s.hotel?.distanceToHaramM).toLocaleString('en') })}`}
            </p>
          </li>
        ) : (
          <li key={k} className="relative rounded-lg bg-accent-light px-3 py-2 text-sm">
            <span className="absolute -start-[1.72rem] top-2 text-base" aria-hidden="true">{MODE_ICON[it.tr.mode]}</span>
            {t(`transport.${it.tr.mode}`)}: {t(`cities.${it.tr.from}`)} → {t(`cities.${it.tr.to}`)}
            {it.tr.costSAR !== undefined && <span className="text-ink-muted"> · {formatSAR(it.tr.costSAR, lang)}</span>}
          </li>
        )
      )}
    </ol>
  );
}

function ShareCard({ trip, setTrip, setError }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = trip.shareToken ? `${window.location.origin}/share/${trip.shareToken}` : '';

  const create = async () => {
    try {
      const res = await api.post(`/trips/${trip._id}/share`);
      setTrip({ ...trip, shareToken: res.data.shareToken });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const stop = async () => {
    try {
      await api.delete(`/trips/${trip._id}/share`);
      setTrip({ ...trip, shareToken: undefined });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-bold">{t('trip.share.title')}</h2>
      <p className="mb-3 text-sm text-ink-muted">{t('trip.share.desc')}</p>
      {link ? (
        <div className="space-y-2">
          <input readOnly dir="ltr" className="input text-xs" value={link} onFocus={(e) => e.target.select()} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={copy}>{copied ? t('common.copied') : t('common.copy')}</button>
            <button type="button" className="btn-danger" onClick={stop}>{t('trip.share.stop')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-gold" onClick={create}>{t('trip.share.create')}</button>
      )}
    </section>
  );
}

export default function OverviewTab({ trip, setTrip, setError }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { insights } = trip;
  const hc = insights.homeCurrency;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <section className="card">
          <h2 className="mb-4 text-lg font-bold">{t('trip.itinerary')}</h2>
          <Itinerary stays={trip.stays} transfers={trip.transfers} lang={lang} />
          {insights.warnings.includes('noMakkahStay') && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('wizard.noMakkahWarning')}</p>
          )}
        </section>
        <MiqatCard miqat={insights.miqat} />
      </div>
      <div className="space-y-5 lg:col-span-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">{t('trip.costBreakdown')}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">{t('wizard.subtotal')}</dt><dd>{formatSAR(trip.accommodationSubtotalSAR, lang)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">{t('wizard.vat')}</dt><dd>{formatSAR(trip.vatSAR, lang)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">{t('wizard.transport')}</dt><dd>{formatSAR(trip.transportSAR, lang)}</dd></div>
            <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold text-brand"><dt>{t('wizard.total')}</dt><dd>{formatSAR(trip.totalCostSAR, lang)}</dd></div>
            {hc.code !== 'SAR' && <p className="text-end text-ink-muted">≈ {formatMoney(hc.totalCost, hc.code, lang)}</p>}
          </dl>
        </section>
        <ShareCard trip={trip} setTrip={setTrip} setError={setError} />
      </div>
    </div>
  );
}
