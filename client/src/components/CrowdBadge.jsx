import { useTranslation } from 'react-i18next';

const STYLES = {
  High: 'bg-red-100 text-red-800 ring-red-200',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  Low: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
};

export default function CrowdBadge({ level, label }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STYLES[level] || ''}`}
      title={t(`crowd.level.${level}`)}
    >
      {label && <span className="opacity-80">{label}</span>}
      <span>{t(`crowd.level.${level}`)}</span>
    </span>
  );
}
