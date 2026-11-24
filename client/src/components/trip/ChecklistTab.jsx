import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';

export default function ChecklistTab({ trip, setTrip, setError }) {
  const { t } = useTranslation();
  const done = trip.checklist.filter((i) => i.done).length;

  const toggle = async (item) => {
    const next = !item.done;
    const apply = (value) =>
      setTrip((tr) => ({ ...tr, checklist: tr.checklist.map((i) => (i._id === item._id ? { ...i, done: value } : i)) }));
    apply(next); // optimistic
    try {
      await api.patch(`/trips/${trip._id}/checklist/${item._id}`, { done: next });
    } catch (err) {
      apply(!next);
      setError(errorMessage(err));
    }
  };

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('trip.checklist')}</h2>
        <span className="text-sm text-ink-muted">{t('dashboard.progress', { done, total: trip.checklist.length })}</span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {trip.checklist.map((item) => (
          <li key={item._id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-brand-light">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item)} className="mt-0.5 h-4 w-4 accent-brand" />
              <span className={item.done ? 'text-ink-muted line-through' : ''}>{t(`checklist.${item.title}`, { defaultValue: item.title })}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
