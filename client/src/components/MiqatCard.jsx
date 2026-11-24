import { useTranslation } from 'react-i18next';

export default function MiqatCard({ miqat }) {
  const { t, i18n } = useTranslation();
  if (!miqat) return null;
  return (
    <div className="rounded-xl border-s-4 border-accent bg-accent-light p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">{t('miqat.title')}</p>
      <p className="text-lg font-bold text-brand">{i18n.language === 'ar' ? miqat.nameAr : miqat.name}</p>
      <p className="text-xs text-ink-muted">{t('miqat.distance', { km: miqat.distanceToMakkahKm })}</p>
      <p className="mt-2 text-sm">{t(`miqat.${miqat.reason}`)}</p>
      <p className="mt-1 text-xs text-ink-muted">{t('miqat.note')}</p>
    </div>
  );
}
