import { useTranslation } from 'react-i18next';
import { Alert, OptionButton } from '../ui';
import { WizardNav } from './common';
import { nightsBetween, todayISO } from '../../utils/format';
import { CITIES, MAX_STAYS, nextStay, presetStays, validateStays } from '../../utils/itinerary';

const PRESETS = [
  ['presetMakkah', ['Makkah']],
  ['presetMadinahFirst', ['Madinah', 'Makkah']],
  ['presetMakkahFirst', ['Makkah', 'Madinah']],
];

/** Step 2: stays (city + dates), with quick-start presets. */
export default function ItineraryStep({ form, update, onBack, onNext }) {
  const { t } = useTranslation();
  const { stays } = form;
  const { errors, ok } = validateStays(stays);

  const setStays = (next) => update({ stays: next, transferModes: [] });
  const setStay = (i, patch) =>
    update({ stays: stays.map((s, j) => (j === i ? { ...s, ...patch, ...(patch.city ? { hotelId: '' } : {}) } : s)) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">{t('wizard.presets')}:</span>
        {PRESETS.map(([key, cities]) => (
          <button key={key} type="button" className="btn-secondary !py-1" onClick={() => setStays(presetStays(cities, stays[0]?.checkIn || undefined))}>
            {t(`wizard.${key}`)}
          </button>
        ))}
      </div>
      <Alert kind="info">{t('wizard.itineraryTip')}</Alert>

      {stays.map((s, i) => {
        const nights = s.checkIn && s.checkOut ? nightsBetween(s.checkIn, s.checkOut) : 0;
        return (
          <fieldset key={i} className="rounded-xl p-4 ring-1 ring-brand/15">
            <div className="mb-3 flex items-center justify-between">
              <legend className="font-semibold text-brand">{t('wizard.stay', { n: i + 1 })}</legend>
              {stays.length > 1 && (
                <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => setStays(stays.filter((_, j) => j !== i))}>
                  {t('common.remove')}
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex gap-2">
                {CITIES.map((c) => (
                  <OptionButton key={c} selected={s.city === c} onClick={() => setStay(i, { city: c })} className="flex-1 px-2 py-2 text-center text-sm font-semibold">
                    {t(`cities.${c}`)}
                  </OptionButton>
                ))}
              </div>
              <label className="text-xs text-ink-muted">
                <input type="date" className="input mb-1 text-ink" min={i === 0 ? todayISO() : stays[i - 1].checkOut} value={s.checkIn} onChange={(e) => setStay(i, { checkIn: e.target.value })} />
                {t('wizard.startDate')}
              </label>
              <label className="text-xs text-ink-muted">
                <input type="date" className="input mb-1 text-ink" min={s.checkIn || todayISO()} value={s.checkOut} onChange={(e) => setStay(i, { checkOut: e.target.value })} />
                {t('wizard.endDate')}
                {nights > 0 && ` · ${t('dashboard.nights', { count: nights })}`}
              </label>
            </div>
            {errors[i] && errors[i] !== 'missing' && <p className="mt-2 text-sm text-red-700">{t(`wizard.${errors[i]}`)}</p>}
          </fieldset>
        );
      })}

      {stays.length < MAX_STAYS && (
        <button type="button" className="btn-secondary w-full border-dashed" onClick={() => setStays([...stays, nextStay(stays[stays.length - 1])])}>
          + {t('wizard.addStay')}
        </button>
      )}
      {!stays.some((s) => s.city === 'Makkah') && <Alert kind="warning">{t('wizard.noMakkahWarning')}</Alert>}
      <WizardNav onBack={onBack} onNext={onNext} nextDisabled={!ok} />
    </div>
  );
}
