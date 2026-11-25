import { useTranslation } from 'react-i18next';

export const STEPS = ['basics', 'itinerary', 'hotels', 'transport', 'review'];

export function Stepper({ step }) {
  const { t } = useTranslation();
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2">
      {STEPS.map((key, i) => (
        <li key={key} className="flex flex-1 items-center gap-2">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
              i < step ? 'bg-brand text-white' : i === step ? 'bg-accent text-brand-dark' : 'bg-brand-light text-ink-muted'
            }`}
          >
            {i < step ? '✓' : i + 1}
          </span>
          <span className={`hidden text-sm sm:inline ${i === step ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{t(`wizard.steps.${key}`)}</span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-black/10" />}
        </li>
      ))}
    </ol>
  );
}

export function WizardNav({ onBack, onNext, nextDisabled, nextLabel }) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} className="btn-secondary">
          {t('common.back')}
        </button>
      ) : (
        <span />
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="btn-primary">
        {nextLabel || t('common.next')}
      </button>
    </div>
  );
}
