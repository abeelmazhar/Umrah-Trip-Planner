import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';
import { isoDay } from '../../utils/format';

const blank = () => ({ name: '', gender: 'male', passportExpiry: '', meningitisVaccine: false });

function Issue({ issue }) {
  const { t } = useTranslation();
  const error = issue.severity === 'error';
  return (
    <p className={`rounded-lg px-3 py-1.5 text-sm ${error ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
      {error ? '⛔' : '⚠️'} {t(`travellers.issues.${issue.code}`, { count: issue.count })}
    </p>
  );
}

export default function TravellersTab({ trip, setTrip, setError }) {
  const { t } = useTranslation();
  const [list, setList] = useState(() =>
    trip.travellers.length
      ? trip.travellers.map((x) => ({ ...x, passportExpiry: x.passportExpiry ? isoDay(x.passportExpiry) : '' }))
      : [blank()]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { issues, ok } = trip.insights.documents;

  const set = (i, patch) => {
    setSaved(false);
    setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const travellers = list.filter((x) => x.name.trim());
      const res = await api.patch(`/trips/${trip._id}`, { travellers });
      setTrip(res.data);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const general = issues.filter((x) => x.traveller === null);

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t('travellers.title')}</h2>
        <p className="text-xs text-ink-muted">🔒 {t('travellers.privacy')}</p>
      </div>

      {ok && issues.length === 0 && <p className="rounded-lg bg-brand-light p-3 text-sm text-brand">✅ {t('travellers.allGood')}</p>}
      {general.map((x) => <Issue key={x.code} issue={x} />)}

      {list.map((x, i) => {
        const mine = issues.filter((is) => is.traveller === i);
        return (
          <fieldset key={i} className="space-y-2 rounded-xl p-3 ring-1 ring-brand/15">
            <div className="grid gap-2 sm:grid-cols-12">
              <input aria-label={t('travellers.name')} placeholder={t('travellers.name')} maxLength={80} className="input sm:col-span-4" value={x.name} onChange={(e) => set(i, { name: e.target.value })} />
              <select aria-label={t('travellers.gender')} className="input sm:col-span-2" value={x.gender} onChange={(e) => set(i, { gender: e.target.value })}>
                <option value="male">{t('travellers.male')}</option>
                <option value="female">{t('travellers.female')}</option>
              </select>
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <span className="whitespace-nowrap text-ink-muted">{t('travellers.passportExpiry')}</span>
                <input type="date" className="input" value={x.passportExpiry} onChange={(e) => set(i, { passportExpiry: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={x.meningitisVaccine} onChange={(e) => set(i, { meningitisVaccine: e.target.checked })} />
                {t('travellers.vaccine')}
              </label>
              <button type="button" className="text-sm text-red-700 hover:underline sm:col-span-1" onClick={() => setList(list.filter((_, j) => j !== i))}>
                {t('common.remove')}
              </button>
            </div>
            {mine.map((is) => <Issue key={is.code} issue={is} />)}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={list.length >= 50} onClick={() => setList([...list, blank()])}>+ {t('travellers.add')}</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('common.loading') : saved ? `✓ ${t('common.saved')}` : t('common.save')}</button>
      </div>
    </form>
  );
}
