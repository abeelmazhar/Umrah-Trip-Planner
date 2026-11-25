import { useTranslation } from 'react-i18next';
import { Field } from '../ui';
import { WizardNav } from './common';

/** Step 1: trip name, group size, where you travel from (miqat) and your currency. */
export default function BasicsStep({ form, update, meta, onNext }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <Field id="title" label={t('wizard.tripTitle')} optional>
        <input id="title" className="input" maxLength={80} placeholder={t('wizard.tripTitlePlaceholder')} value={form.title} onChange={(e) => update({ title: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="people" label={t('wizard.people')}>
          <input id="people" type="number" min={1} max={50} className="input" value={form.people} onChange={(e) => update({ people: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
        </Field>
        <Field id="origin" label={t('wizard.origin')} hint={t('wizard.originHint')}>
          <select id="origin" className="input" value={form.originRegion} onChange={(e) => update({ originRegion: e.target.value })}>
            {Object.entries(meta.originRegions).map(([key, r]) => (
              <option key={key} value={key}>
                {t(`regions.${key}`)} ({r.examples})
              </option>
            ))}
          </select>
        </Field>
        <Field id="currency" label={t('wizard.currency')} hint={t('wizard.currencyHint')}>
          <select id="currency" className="input" value={form.homeCurrency} onChange={(e) => update({ homeCurrency: e.target.value })}>
            {Object.keys(meta.currencies).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <WizardNav onNext={onNext} />
    </div>
  );
}
