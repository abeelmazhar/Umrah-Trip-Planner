import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useMeta from '../hooks/useMeta';
import MiqatCard from '../components/MiqatCard';
import { addDaysISO, formatDate, formatMoney, formatSAR, nightsBetween, todayISO } from '../utils/format';

const STEPS = ['basics', 'itinerary', 'hotels', 'transport', 'review'];
const CITIES = ['Makkah', 'Madinah'];

function Stepper({ step }) {
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
          <span className={`hidden text-sm sm:inline ${i === step ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
            {t(`wizard.steps.${key}`)}
          </span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-black/10" />}
        </li>
      ))}
    </ol>
  );
}

const Nav = ({ onBack, onNext, nextDisabled, nextLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex justify-between">
      {onBack ? <button type="button" onClick={onBack} className="btn-secondary">{t('common.back')}</button> : <span />}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="btn-primary">
        {nextLabel || t('common.next')}
      </button>
    </div>
  );
};

/* ---------- Step 1: who and from where ---------- */
function BasicsStep({ form, setForm, meta, onNext }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="title">
          {t('wizard.tripTitle')} <span className="font-normal text-ink-muted">({t('common.optional')})</span>
        </label>
        <input id="title" className="input" maxLength={80} placeholder={t('wizard.tripTitlePlaceholder')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="people">{t('wizard.people')}</label>
          <input id="people" type="number" min={1} max={50} className="input" value={form.people} onChange={(e) => setForm({ ...form, people: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
        </div>
        <div>
          <label className="label" htmlFor="origin">{t('wizard.origin')}</label>
          <select id="origin" className="input" value={form.originRegion} onChange={(e) => setForm({ ...form, originRegion: e.target.value })}>
            {Object.entries(meta.originRegions).map(([key, r]) => (
              <option key={key} value={key}>{t(`regions.${key}`)} ({r.examples})</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{t('wizard.originHint')}</p>
        </div>
        <div>
          <label className="label" htmlFor="currency">{t('wizard.currency')}</label>
          <select id="currency" className="input" value={form.homeCurrency} onChange={(e) => setForm({ ...form, homeCurrency: e.target.value })}>
            {Object.keys(meta.currencies).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{t('wizard.currencyHint')}</p>
        </div>
      </div>
      <Nav onNext={onNext} />
    </div>
  );
}

/* ---------- Step 2: stays (cities + dates) ---------- */
function validateStays(stays) {
  const errors = stays.map((s, i) => {
    if (!s.checkIn || !s.checkOut) return 'missing';
    if (nightsBetween(s.checkIn, s.checkOut) < 1) return 'datesInvalid';
    if (i > 0 && stays[i - 1].checkOut && s.checkIn < stays[i - 1].checkOut) return 'orderInvalid';
    return null;
  });
  return { errors, ok: errors.every((e) => e === null) };
}

function ItineraryStep({ form, setForm, onBack, onNext }) {
  const { t } = useTranslation();
  const { errors, ok } = validateStays(form.stays);
  const setStay = (i, patch) => setForm({ ...form, stays: form.stays.map((s, j) => (j === i ? { ...s, ...patch, ...(patch.city ? { hotelId: '' } : {}) } : s)) });

  const preset = (cities) => {
    const start = form.stays[0]?.checkIn || addDaysISO(todayISO(), 30);
    let d = start;
    const stays = cities.map((city, i) => {
      const nights = cities.length === 1 ? 7 : i === 0 ? 4 : 6;
      const s = { city, checkIn: d, checkOut: addDaysISO(d, nights), hotelId: '' };
      d = s.checkOut;
      return s;
    });
    setForm({ ...form, stays, transferModes: [] });
  };

  const addStay = () => {
    const last = form.stays[form.stays.length - 1];
    const city = last.city === 'Makkah' ? 'Madinah' : 'Makkah';
    const checkIn = last.checkOut || '';
    setForm({ ...form, stays: [...form.stays, { city, checkIn, checkOut: checkIn ? addDaysISO(checkIn, 3) : '', hotelId: '' }] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">{t('wizard.presets')}:</span>
        <button type="button" className="btn-secondary !py-1" onClick={() => preset(['Makkah'])}>{t('wizard.presetMakkah')}</button>
        <button type="button" className="btn-secondary !py-1" onClick={() => preset(['Madinah', 'Makkah'])}>{t('wizard.presetMadinahFirst')}</button>
        <button type="button" className="btn-secondary !py-1" onClick={() => preset(['Makkah', 'Madinah'])}>{t('wizard.presetMakkahFirst')}</button>
      </div>
      <p className="rounded-lg bg-accent-light p-3 text-sm">{t('wizard.itineraryTip')}</p>

      {form.stays.map((s, i) => (
        <fieldset key={i} className="rounded-xl p-4 ring-1 ring-brand/15">
          <div className="mb-3 flex items-center justify-between">
            <legend className="font-semibold text-brand">{t('wizard.stay', { n: i + 1 })}</legend>
            {form.stays.length > 1 && (
              <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => setForm({ ...form, stays: form.stays.filter((_, j) => j !== i), transferModes: [] })}>
                {t('common.remove')}
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex gap-2">
              {CITIES.map((c) => (
                <button key={c} type="button" onClick={() => setStay(i, { city: c })} aria-pressed={s.city === c}
                  className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold ring-2 transition ${s.city === c ? 'bg-brand-light ring-brand' : 'bg-white ring-black/5 hover:ring-brand/40'}`}>
                  {t(`cities.${c}`)}
                </button>
              ))}
            </div>
            <div>
              <label className="label sr-only" htmlFor={`in-${i}`}>{t('wizard.startDate')}</label>
              <input id={`in-${i}`} type="date" aria-label={t('wizard.startDate')} className="input" min={i === 0 ? todayISO() : form.stays[i - 1].checkOut} value={s.checkIn} onChange={(e) => setStay(i, { checkIn: e.target.value })} />
              <span className="text-xs text-ink-muted">{t('wizard.startDate')}</span>
            </div>
            <div>
              <input type="date" aria-label={t('wizard.endDate')} className="input" min={s.checkIn || todayISO()} value={s.checkOut} onChange={(e) => setStay(i, { checkOut: e.target.value })} />
              <span className="text-xs text-ink-muted">
                {t('wizard.endDate')}
                {s.checkIn && s.checkOut && nightsBetween(s.checkIn, s.checkOut) > 0 && ` · ${t('dashboard.nights', { count: nightsBetween(s.checkIn, s.checkOut) })}`}
              </span>
            </div>
          </div>
          {errors[i] && errors[i] !== 'missing' && <p className="mt-2 text-sm text-red-700">{t(`wizard.${errors[i]}`)}</p>}
        </fieldset>
      ))}

      {form.stays.length < 6 && (
        <button type="button" className="btn-secondary w-full border-dashed" onClick={addStay}>+ {t('wizard.addStay')}</button>
      )}
      {!form.stays.some((s) => s.city === 'Makkah') && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('wizard.noMakkahWarning')}</p>
      )}
      <Nav onBack={onBack} onNext={onNext} nextDisabled={!ok} />
    </div>
  );
}

/* ---------- Step 3: a hotel for each stay ---------- */
function HotelsStep({ form, setForm, hotels, onBack, onNext }) {
  const { t, i18n } = useTranslation();
  const rooms = Math.ceil(form.people / 2);
  const choose = (i, h) => setForm({ ...form, stays: form.stays.map((s, j) => (j === i ? { ...s, hotelId: h._id } : s)) });

  return (
    <div className="space-y-6">
      {!hotels && <p className="text-ink-muted">{t('common.loading')}</p>}
      {hotels && form.stays.map((s, i) => {
        const list = hotels.filter((h) => h.city === s.city);
        const nights = nightsBetween(s.checkIn, s.checkOut);
        return (
          <section key={i}>
            <h3 className="mb-2 font-semibold text-brand">
              {t('wizard.stay', { n: i + 1 })} · {t('wizard.chooseHotelFor', { city: t(`cities.${s.city}`) })}
              <span className="ms-2 text-sm font-normal text-ink-muted">
                {formatDate(s.checkIn, i18n.language)} – {formatDate(s.checkOut, i18n.language)}
              </span>
            </h3>
            {list.length === 0 && <p className="text-ink-muted">{t('wizard.noHotels')}</p>}
            <ul className="grid gap-2">
              {list.map((h) => {
                const selected = s.hotelId === h._id;
                return (
                  <li key={h._id}>
                    <button type="button" onClick={() => choose(i, h)} aria-pressed={selected}
                      className={`flex w-full flex-wrap items-center gap-3 rounded-xl p-3 text-start ring-2 transition ${selected ? 'bg-brand-light ring-brand' : 'bg-white ring-black/5 hover:ring-brand/40'}`}>
                      <div className="flex-1">
                        <p className="font-semibold">{h.name}</p>
                        <p className="text-sm text-ink-muted">★ {h.rating} · {t('wizard.fromHaram', { distance: h.distanceToHaramM.toLocaleString('en') })}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-bold text-brand">{t('wizard.perNight', { price: formatSAR(h.pricePerNightSAR, i18n.language) })}</p>
                        <p className="text-xs text-ink-muted">{t('wizard.estimate', { price: formatSAR(h.pricePerNightSAR * nights * rooms, i18n.language) })}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <Nav onBack={onBack} onNext={onNext} nextDisabled={!form.stays.every((s) => s.hotelId)} />
    </div>
  );
}

/* ---------- Step 4: transport between cities ---------- */
export function transfersNeeded(stays) {
  const out = [];
  for (let i = 1; i < stays.length; i += 1) {
    if (stays[i].city !== stays[i - 1].city) out.push({ from: stays[i - 1].city, to: stays[i].city, date: stays[i].checkIn });
  }
  return out;
}

function groupCost(option, people) {
  return option.pricing === 'perVehicle' ? Math.ceil(people / option.seats) * option.priceSAR : people * option.priceSAR;
}

function TransportStep({ form, setForm, meta, onBack, onNext }) {
  const { t, i18n } = useTranslation();
  const needed = transfersNeeded(form.stays);
  const modes = needed.map((_, i) => form.transferModes[i]);
  const setMode = (i, mode) => {
    const next = [...modes];
    next[i] = mode;
    setForm({ ...form, transferModes: next });
  };

  return (
    <div className="space-y-6">
      {needed.length === 0 && <p className="rounded-lg bg-brand-light p-4 text-sm">{t('wizard.noTransport')}</p>}
      {needed.map((leg, i) => (
        <section key={i}>
          <h3 className="mb-2 font-semibold text-brand">
            {t('wizard.transportFor', { from: t(`cities.${leg.from}`), to: t(`cities.${leg.to}`), date: formatDate(leg.date, i18n.language) })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(meta.transport).map(([mode, o]) => {
              const selected = modes[i] === mode;
              return (
                <button key={mode} type="button" onClick={() => setMode(i, mode)} aria-pressed={selected}
                  className={`rounded-xl p-4 text-start ring-2 transition ${selected ? 'bg-brand-light ring-brand' : 'bg-white ring-black/5 hover:ring-brand/40'}`}>
                  <p className="text-2xl" aria-hidden="true">{mode === 'train' ? '🚄' : mode === 'bus' ? '🚌' : '🚗'}</p>
                  <p className="font-semibold">{t(`transport.${mode}`)}</p>
                  <p className="text-xs text-ink-muted">
                    {o.pricing === 'perVehicle'
                      ? t('wizard.perVehicle', { price: formatSAR(o.priceSAR, i18n.language), seats: o.seats })
                      : t('wizard.perPerson', { price: formatSAR(o.priceSAR, i18n.language) })}
                  </p>
                  <p className="text-xs text-ink-muted">{t('wizard.duration', { h: Math.floor(o.durationMin / 60), m: o.durationMin % 60 })}</p>
                  <p className="mt-1 font-bold text-brand">{t('wizard.groupCost', { price: formatSAR(groupCost(o, form.people), i18n.language) })}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <Nav onBack={onBack} onNext={onNext} nextDisabled={!modes.every(Boolean)} />
    </div>
  );
}

/* ---------- Step 5: server quote + save ---------- */
function ReviewStep({ form, onBack }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lang = i18n.language;

  const payload = useMemo(
    () => ({
      title: form.title,
      people: form.people,
      originRegion: form.originRegion,
      homeCurrency: form.homeCurrency,
      stays: form.stays.map(({ city, hotelId, checkIn, checkOut }) => ({ city, hotelId, checkIn, checkOut })),
      transferModes: transfersNeeded(form.stays).map((_, i) => form.transferModes[i]),
    }),
    [form]
  );

  useEffect(() => {
    api.post('/trips/quote', payload).then((r) => setQuote(r.data)).catch((err) => setError(errorMessage(err, t('common.error'))));
  }, [payload, t]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/trips', payload);
      navigate(`/trips/${res.data._id}`);
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
      setSaving(false);
    }
  };

  const Row = ({ label, children, strong, sub }) => (
    <div className={`flex justify-between gap-4 py-2 ${strong ? 'text-lg font-bold text-brand' : ''}`}>
      <dt className={strong ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-end">{children}{sub && <span className="block text-xs font-normal text-ink-muted">{sub}</span>}</dd>
    </div>
  );

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {!quote && !error && <p className="text-ink-muted">{t('common.loading')}</p>}
      {quote && (
        <>
          <dl className="divide-y divide-black/5">
            {quote.stays.map((s, i) => (
              <Row key={i} label={`${t('wizard.stay', { n: i + 1 })} · ${t(`cities.${s.city}`)}`}
                sub={`${formatDate(s.checkIn, lang)} – ${formatDate(s.checkOut, lang)} · ${t('wizard.calc', { nights: s.nights, price: formatSAR(s.pricePerNightSAR, lang), rooms: s.rooms })}`}>
                <span className="font-medium">{s.hotel?.name}</span> · {formatSAR(s.subtotalSAR, lang)}
              </Row>
            ))}
            <Row label={t('wizard.subtotal')} sub={`${t('dashboard.people', { count: form.people })} · ${t('wizard.rooms', { count: quote.rooms })} (${t('wizard.roomsNote')})`}>
              {formatSAR(quote.accommodationSubtotalSAR, lang)}
            </Row>
            <Row label={t('wizard.vat')}>{formatSAR(quote.vatSAR, lang)}</Row>
            {quote.transfers.map((tr, i) => (
              <Row key={`t${i}`} label={`${t('wizard.transport')} · ${t(`transport.${tr.mode}`)}`} sub={`${t(`cities.${tr.from}`)} → ${t(`cities.${tr.to}`)}`}>
                {formatSAR(tr.costSAR, lang)}
              </Row>
            ))}
            <Row label={t('wizard.total')} strong sub={form.homeCurrency !== 'SAR' ? t('wizard.inYourCurrency', { amount: formatMoney(quote.homeCurrency.totalCost, form.homeCurrency, lang) }) : null}>
              {formatSAR(quote.totalCostSAR, lang)}
            </Row>
          </dl>
          {quote.warnings.includes('noMakkahStay') && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('wizard.noMakkahWarning')}</p>}
          <MiqatCard miqat={quote.miqat} />
        </>
      )}
      <Nav onBack={onBack} onNext={save} nextDisabled={!quote || saving} nextLabel={saving ? t('common.loading') : t('wizard.confirm')} />
    </div>
  );
}

export default function NewTrip() {
  const { t } = useTranslation();
  const meta = useMeta();
  const [hotels, setHotels] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: '',
    people: 2,
    originRegion: 'south-asia',
    homeCurrency: 'PKR',
    stays: [{ city: 'Madinah', checkIn: '', checkOut: '', hotelId: '' }, { city: 'Makkah', checkIn: '', checkOut: '', hotelId: '' }],
    transferModes: [],
  });

  useEffect(() => {
    api.get('/hotels').then((r) => setHotels(r.data)).catch(() => setHotels([]));
  }, []);

  const go = (n) => () => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold text-brand">{t('wizard.title')}</h1>
      <div className="card">
        <Stepper step={step} />
        {!meta ? (
          <p className="text-ink-muted">{t('common.loading')}</p>
        ) : (
          <>
            {step === 0 && <BasicsStep form={form} setForm={setForm} meta={meta} onNext={go(1)} />}
            {step === 1 && <ItineraryStep form={form} setForm={setForm} onBack={go(0)} onNext={go(2)} />}
            {step === 2 && <HotelsStep form={form} setForm={setForm} hotels={hotels} onBack={go(1)} onNext={go(3)} />}
            {step === 3 && <TransportStep form={form} setForm={setForm} meta={meta} onBack={go(2)} onNext={go(4)} />}
            {step === 4 && <ReviewStep form={form} onBack={go(3)} />}
          </>
        )}
      </div>
    </div>
  );
}
