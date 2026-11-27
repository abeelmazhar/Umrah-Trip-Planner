import { useTranslation } from 'react-i18next';
import { Alert, OptionButton } from '../ui';
import Icon from '../Icon';
import { WizardNav } from './common';
import { formatDate, formatSAR } from '../../utils/format';
import { MODE_ICON, groupCost, transfersNeeded } from '../../utils/itinerary';

/** Step 4: train / bus / car for every change of city (skipped text when there is none). */
export default function TransportStep({ form, update, meta, onBack, onNext }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const legs = transfersNeeded(form.stays);
  const modes = legs.map((_, i) => form.transferModes[i]);
  const setMode = (i, mode) => update({ transferModes: modes.map((m, j) => (j === i ? mode : m)) });

  return (
    <div className="space-y-6">
      {legs.length === 0 && <Alert kind="success">{t('wizard.noTransport')}</Alert>}
      {legs.map((leg, i) => (
        <section key={i}>
          <h3 className="mb-2 font-semibold text-brand">
            {t('wizard.transportFor', { from: t(`cities.${leg.from}`), to: t(`cities.${leg.to}`), date: formatDate(leg.date, lang) })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(meta.transport).map(([mode, o]) => (
              <OptionButton key={mode} selected={modes[i] === mode} onClick={() => setMode(i, mode)} className="p-4">
                <Icon name={MODE_ICON[mode]} className="mb-1 h-6 w-6 text-brand" />
                <p className="font-semibold">{t(`transport.${mode}`)}</p>
                <p className="text-xs text-ink-muted">
                  {o.pricing === 'perVehicle'
                    ? t('wizard.perVehicle', { price: formatSAR(o.priceSAR, lang), seats: o.seats })
                    : t('wizard.perPerson', { price: formatSAR(o.priceSAR, lang) })}
                </p>
                <p className="text-xs text-ink-muted">{t('wizard.duration', { h: Math.floor(o.durationMin / 60), m: o.durationMin % 60 })}</p>
                <p className="mt-1 font-bold text-brand">{t('wizard.groupCost', { price: formatSAR(groupCost(o, form.people), lang) })}</p>
              </OptionButton>
            ))}
          </div>
        </section>
      ))}
      <WizardNav onBack={onBack} onNext={onNext} nextDisabled={!modes.every(Boolean)} />
    </div>
  );
}
