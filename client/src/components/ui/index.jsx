import { useTranslation } from 'react-i18next';

/** Red (error), amber (warning), green (success) or neutral message box. */
export function Alert({ kind = 'error', children, className = '' }) {
  if (!children) return null;
  const styles = {
    error: 'bg-red-50 text-red-800',
    warning: 'bg-amber-50 text-amber-900',
    success: 'bg-brand-light text-brand',
    info: 'bg-accent-light text-ink',
  };
  return (
    <p role={kind === 'error' ? 'alert' : undefined} className={`rounded-lg p-3 text-sm ${styles[kind]} ${className}`}>
      {children}
    </p>
  );
}

/** Grey block used while a first fetch is in flight. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-brand/10 ${className}`} />;
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** First-load placeholder. A refresh of data that is already on screen does not use this. */
export function Loading({ cards = 2, title = true }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label={t('common.loading')}>
      <span className="sr-only">{t('common.loading')}</span>
      {title && <Skeleton className="h-8 w-40 max-w-full" />}
      {Array.from({ length: cards }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

/** White card with a heading and an optional action on the other side. */
export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A selectable card (city, hotel, transport mode…): highlighted when selected. */
export function OptionButton({ selected, onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl text-start ring-2 transition ${selected ? 'bg-brand-light ring-brand' : 'bg-white ring-black/5 hover:ring-brand/40'} ${className}`}
    >
      {children}
    </button>
  );
}

/** Label + input/select/textarea, wired with htmlFor. */
export function Field({ id, label, hint, optional, children }) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-ink-muted"> ({t('common.optional')})</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
