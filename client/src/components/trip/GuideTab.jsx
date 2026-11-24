import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';

const TALBIYAH_AR = 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ';
const RABBANA_AR = 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ';

function Step({ n, title, done, locked, lockedText, children }) {
  const { t } = useTranslation();
  return (
    <section className={`card transition ${locked ? 'opacity-60' : ''} ${done ? 'ring-2 ring-brand/40' : ''}`}>
      <div className="mb-2 flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? 'bg-brand text-white' : 'bg-accent text-brand-dark'}`}>
          {done ? '✓' : n}
        </span>
        <div>
          <p className="text-xs text-ink-muted">{t('guide.step', { n })}</p>
          <h3 className="font-bold text-brand">{title}</h3>
        </div>
      </div>
      {locked ? <p className="text-sm text-ink-muted">{lockedText}</p> : children}
    </section>
  );
}

/** Seven dots plus big "round done" / "undo" buttons. */
function Counter({ value, onChange, labelFor }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} title={labelFor(i + 1)}
            className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ring-2 ${i < value ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-muted ring-brand/20'}`}>
            {i + 1}
          </span>
        ))}
        <span className="ms-2 font-semibold">{t('guide.ofSeven', { n: value })}</span>
      </div>
      {value < 7 && <p className="text-sm text-ink-muted">{t('guide.round', { n: value + 1 })}: {labelFor(value + 1)}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1 py-4 text-base" disabled={value >= 7} onClick={() => onChange(value + 1)}>
          {t('guide.roundDone')}
        </button>
        <button type="button" className="btn-secondary" disabled={value <= 0} onClick={() => onChange(value - 1)}>{t('guide.undo')}</button>
      </div>
    </div>
  );
}

export default function GuideTab({ trip, setTrip, setError }) {
  const { t } = useTranslation();
  const [ritual, setRitual] = useState(trip.ritual);
  const queue = useRef(Promise.resolve());

  // Optimistic: update the screen, then save. Requests are queued so they arrive in order.
  const save = (patch) => {
    const before = ritual;
    const next = { ...ritual, ...patch };
    setRitual(next);
    queue.current = queue.current.then(() =>
      api
        .patch(`/trips/${trip._id}/ritual`, patch)
        .then((r) => {
          setRitual(r.data);
          setTrip((tr) => ({ ...tr, ritual: r.data }));
        })
        .catch((err) => {
          setRitual(before);
          setError(errorMessage(err));
        })
    );
  };

  const r = ritual;
  const saiLabel = (n) => (n % 2 === 1 ? t('guide.sai.toMarwah') : t('guide.sai.toSafa'));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-brand-light">
        <h2 className="text-lg font-bold text-brand">{t('guide.title')}</h2>
        {r.completedUmrahs > 0 && <p className="text-sm font-semibold text-brand">🤲 {t('guide.completed', { count: r.completedUmrahs })}</p>}
      </div>

      <Step n={1} title={t('guide.ihram.title')} done={r.ihram}>
        <p className="mb-3 text-sm">{t('guide.ihram.body')}</p>
        <div className="mb-3 rounded-xl bg-accent-light p-4">
          <p className="mb-1 text-xs font-semibold uppercase text-accent-dark">{t('guide.talbiyah')}</p>
          <p lang="ar" dir="rtl" className="font-arabic text-xl leading-loose">{TALBIYAH_AR}</p>
          <p dir="ltr" className="mt-1 text-sm italic text-ink-muted">{t('guide.talbiyahTranslit')}</p>
          <p className="mt-1 text-sm">{t('guide.talbiyahMeaning')}</p>
        </div>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-brand" checked={r.ihram} disabled={r.tawafRounds > 0} onChange={(e) => save({ ihram: e.target.checked })} />
          {t('guide.ihram.done')}
        </label>
      </Step>

      <Step n={2} title={t('guide.tawaf.title')} done={r.tawafRounds === 7} locked={!r.ihram} lockedText={t('guide.lockedTawaf')}>
        <p className="mb-3 text-sm">{t('guide.tawaf.body')}</p>
        <Counter value={r.tawafRounds} onChange={(v) => save({ tawafRounds: v })} labelFor={(n) => t('guide.round', { n })} />
        <div className="mt-3 rounded-xl bg-accent-light p-3">
          <p className="text-xs font-semibold text-accent-dark">{t('guide.tawaf.dua')}</p>
          <p lang="ar" dir="rtl" className="font-arabic text-lg leading-loose">{RABBANA_AR}</p>
          <p className="text-xs text-ink-muted">(Al-Baqarah 2:201)</p>
        </div>
      </Step>

      <Step n={3} title={t('guide.sai.title')} done={r.saiRounds === 7} locked={r.tawafRounds < 7} lockedText={t('guide.lockedSai')}>
        <p className="mb-3 text-sm">{t('guide.sai.body')}</p>
        <Counter value={r.saiRounds} onChange={(v) => save({ saiRounds: v })} labelFor={saiLabel} />
      </Step>

      <Step n={4} title={t('guide.halq.title')} done={r.halq} locked={r.saiRounds < 7} lockedText={t('guide.lockedHalq')}>
        <p className="mb-3 text-sm">{t('guide.halq.body')}</p>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-brand" checked={r.halq} onChange={(e) => save({ halq: e.target.checked })} />
          {t('guide.halq.done')}
        </label>
      </Step>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold" disabled={!(r.ihram && r.tawafRounds === 7 && r.saiRounds === 7 && r.halq)} onClick={() => save({ action: 'complete' })}>
          {t('guide.complete')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => save({ action: 'reset' })}>{t('guide.reset')}</button>
      </div>
    </div>
  );
}
