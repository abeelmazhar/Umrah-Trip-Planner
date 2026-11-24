import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';
import useMeta from '../../hooks/useMeta';
import { formatDate, formatMoney, formatSAR } from '../../utils/format';

const ESTIMATE_KEYS = ['flightsPerPersonSAR', 'visaPerPersonSAR', 'foodPerPersonPerDaySAR', 'ziyaratSAR', 'shoppingSAR', 'otherSAR'];

function Bar({ planned, spent }) {
  const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : spent > 0 ? 100 : 0;
  const over = spent > planned;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-brand-light">
      <div className={`h-full rounded-full ${over ? 'bg-red-600' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BudgetTab({ trip, setTrip, setError }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meta = useMeta();
  const { budget, spending, homeCurrency: hc } = trip.insights;
  const [estimates, setEstimates] = useState(() => Object.fromEntries(ESTIMATE_KEYS.map((k) => [k, trip.budget?.[k] ?? 0])));
  const [savingEst, setSavingEst] = useState(false);
  const [expense, setExpense] = useState({ category: 'food', amount: '', inCurrency: 'SAR', note: '' });
  const toHome = (sar) => formatMoney(sar * hc.rate, hc.code, lang);

  const saveEstimates = async (e) => {
    e.preventDefault();
    setSavingEst(true);
    try {
      const res = await api.patch(`/trips/${trip._id}`, { budget: Object.fromEntries(Object.entries(estimates).map(([k, v]) => [k, Number(v) || 0])) });
      setTrip(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingEst(false);
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const amount = Number(expense.amount);
    if (!(amount > 0)) return;
    // Amounts entered in the home currency are stored in SAR.
    const amountSAR = expense.inCurrency === 'SAR' ? amount : Math.round((amount / hc.rate) * 100) / 100;
    try {
      const res = await api.post(`/trips/${trip._id}/expenses`, { category: expense.category, amountSAR, note: expense.note });
      setTrip(res.data);
      setExpense({ ...expense, amount: '', note: '' });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeExpense = async (id) => {
    try {
      const res = await api.delete(`/trips/${trip._id}/expenses/${id}`);
      setTrip(res.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <section className="card">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-bold">{t('budget.title')}</h2>
            <div className="text-end">
              <p className="text-xl font-bold text-brand">{formatSAR(budget.totalSAR, lang)}</p>
              <p className="text-xs text-ink-muted">
                {t('budget.perPerson', { amount: formatSAR(budget.perPersonSAR, lang) })}
                {hc.code !== 'SAR' && ` · ${t('budget.inCurrency', { amount: toHome(budget.totalSAR) })}`}
              </p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 text-start font-medium">{t('budget.category')}</th>
                <th className="py-1 text-end font-medium">{t('budget.planned')}</th>
                <th className="py-1 text-end font-medium">{t('budget.spent')}</th>
              </tr>
            </thead>
            <tbody>
              {spending.categories.map((c) => (
                <tr key={c.category} className="align-top">
                  <td className="py-2 pe-2">
                    {t(`budget.categories.${c.category}`)}
                    <Bar planned={c.plannedSAR} spent={c.spentSAR} />
                  </td>
                  <td className="py-2 text-end">{formatSAR(c.plannedSAR, lang)}</td>
                  <td className={`py-2 text-end ${c.over ? 'font-semibold text-red-700' : ''}`}>
                    {formatSAR(c.spentSAR, lang)}
                    {c.over && <span className="block text-[11px]">{t('budget.over')}</span>}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-black/10 font-bold">
                <td className="py-2">{t('budget.total')}</td>
                <td className="py-2 text-end">{formatSAR(spending.totalPlannedSAR, lang)}</td>
                <td className="py-2 text-end">{formatSAR(spending.totalSpentSAR, lang)}</td>
              </tr>
              <tr>
                <td className="text-ink-muted">{t('budget.remaining')}</td>
                <td colSpan={2} className={`text-end font-semibold ${spending.remainingSAR < 0 ? 'text-red-700' : 'text-brand'}`}>
                  {formatSAR(spending.remainingSAR, lang)}
                  {hc.code !== 'SAR' && <span className="ms-1 text-xs font-normal text-ink-muted">({toHome(spending.remainingSAR)})</span>}
                </td>
              </tr>
            </tbody>
          </table>
          {meta && hc.code !== 'SAR' && (
            <p className="mt-3 text-xs text-ink-muted">{t('budget.ratesNote', { asOf: meta.ratesAsOf, rate: hc.rate, code: hc.code })}</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-bold">{t('budget.expenses')}</h2>
          {trip.expenses.length === 0 && <p className="text-sm text-ink-muted">{t('budget.noExpenses')}</p>}
          <ul className="divide-y divide-black/5">
            {[...trip.expenses].reverse().map((x) => (
              <li key={x._id} className="flex items-center gap-3 py-2 text-sm">
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand">{t(`budget.categories.${x.category}`)}</span>
                <span className="flex-1 truncate">{x.note || '—'}</span>
                <span className="text-xs text-ink-muted">{formatDate(x.date, lang, { day: 'numeric', month: 'short' })}</span>
                <span className="font-semibold">{formatSAR(x.amountSAR, lang)}</span>
                <button type="button" onClick={() => removeExpense(x._id)} className="text-red-700 hover:underline" aria-label={t('common.delete')}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-5 lg:col-span-2">
        <form onSubmit={addExpense} className="card space-y-3">
          <h2 className="text-lg font-bold">{t('budget.addExpense')}</h2>
          <div>
            <label className="label" htmlFor="ex-cat">{t('budget.category')}</label>
            <select id="ex-cat" className="input" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>
              {(meta?.expenseCategories || ['food']).map((c) => <option key={c} value={c}>{t(`budget.categories.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ex-amount">{t('budget.amount')}</label>
            <div className="flex gap-2">
              <input id="ex-amount" type="number" min="0.01" step="0.01" required className="input" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
              <select aria-label="currency" className="input !w-28" value={expense.inCurrency} onChange={(e) => setExpense({ ...expense, inCurrency: e.target.value })}>
                <option value="SAR">SAR</option>
                {hc.code !== 'SAR' && <option value={hc.code}>{hc.code}</option>}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ex-note">{t('budget.note')} <span className="font-normal text-ink-muted">({t('common.optional')})</span></label>
            <input id="ex-note" maxLength={120} className="input" value={expense.note} onChange={(e) => setExpense({ ...expense, note: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">{t('common.add')}</button>
        </form>

        <form onSubmit={saveEstimates} className="card space-y-3">
          <h2 className="text-lg font-bold">{t('budget.estimates')}</h2>
          {ESTIMATE_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <label className="flex-1 text-sm" htmlFor={k}>{t(`budget.${k}`)}</label>
              <input id={k} type="number" min="0" step="1" className="input !w-32" value={estimates[k]} onChange={(e) => setEstimates({ ...estimates, [k]: e.target.value })} />
            </div>
          ))}
          <button type="submit" disabled={savingEst} className="btn-secondary w-full">{savingEst ? t('common.loading') : t('common.save')}</button>
        </form>
      </div>
    </div>
  );
}
