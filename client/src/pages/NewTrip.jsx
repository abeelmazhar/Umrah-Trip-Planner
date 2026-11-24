import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import { formatDate, formatSAR, nightsBetween, todayISO } from '../utils/format';

const STEPS = ['details', 'hotel', 'review'];

function Stepper({ step }) {
  const { t } = useTranslation();
  return (
    <ol className="mb-6 flex items-center gap-2">
      {STEPS.map((key, i) => (
        <li key={key} className="flex flex-1 items-center gap-2">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
              i < step ? 'bg-brand text-white' : i === step ? 'bg-accent text-brand-dark' : 'bg-brand-light text-ink-muted'
            }`}
          >
            {i + 1}
          </span>
          <span className={`text-sm ${i === step ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
            {t(`wizard.steps.${key}`)}
          </span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-black/10" />}
        </li>
      ))}
    </ol>
  );
}

function DetailsStep({ form, setForm, onNext }) {
  const { t } = useTranslation();
  const nights = nightsBetween(form.startDate, form.endDate);
  const valid = form.startDate && form.endDate && nights >= 1 && form.people >= 1;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onNext();
      }}
    >
      <fieldset>
        <legend className="label">{t('wizard.city')}</legend>
        <div className="grid grid-cols-2 gap-3">
          {['Makkah', 'Madinah'].map((city) => (
            <label
              key={city}
              className={`cursor-pointer rounded-xl p-4 text-center font-semibold ring-2 transition ${
                form.city === city ? 'bg-brand-light ring-brand' : 'bg-white ring-black/5 hover:ring-brand/40'
              }`}
            >
              <input
                type="radio"
                name="city"
                value={city}
                checked={form.city === city}
                onChange={() => setForm({ ...form, city, hotelId: '' })}
                className="sr-only"
              />
              {t(`cities.${city}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="startDate">{t('wizard.startDate')}</label>
          <input id="startDate" type="date" required min={todayISO()} className="input" value={form.startDate} onChange={set('startDate')} />
        </div>
        <div>
          <label className="label" htmlFor="endDate">{t('wizard.endDate')}</label>
          <input id="endDate" type="date" required min={form.startDate || todayISO()} className="input" value={form.endDate} onChange={set('endDate')} />
        </div>
        <div>
          <label className="label" htmlFor="people">{t('wizard.people')}</label>
          <input
            id="people"
            type="number"
            min={1}
            max={50}
            required
            className="input"
            value={form.people}
            onChange={(e) => setForm({ ...form, people: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>
      {form.startDate && form.endDate && nights < 1 && (
        <p className="text-sm text-red-700">{t('wizard.datesInvalid')}</p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={!valid} className="btn-primary">{t('common.next')}</button>
      </div>
    </form>
  );
}

function HotelStep({ form, setForm, onBack, onNext }) {
  const { t, i18n } = useTranslation();
  const [hotels, setHotels] = useState(null);
  const [error, setError] = useState('');
  const nights = nightsBetween(form.startDate, form.endDate);
  const rooms = Math.ceil(form.people / 2);

  useEffect(() => {
    setHotels(null);
    api
      .get('/hotels', { params: { city: form.city } })
      .then((res) => setHotels(res.data))
      .catch((err) => setError(errorMessage(err, t('common.error'))));
  }, [form.city, t]);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!hotels && !error && <p className="text-ink-muted">{t('common.loading')}</p>}
      {hotels?.length === 0 && <p className="text-ink-muted">{t('wizard.noHotels')}</p>}
      <ul className="grid gap-3">
        {hotels?.map((h) => {
          const selected = form.hotelId === h._id;
          return (
            <li key={h._id}>
              <button
                type="button"
                onClick={() => setForm({ ...form, hotelId: h._id, hotel: h })}
                aria-pressed={selected}
                className={`flex w-full flex-wrap items-center gap-3 rounded-xl p-4 text-start ring-2 transition ${
                  selected ? 'bg-brand-light ring-brand' : 'bg-white ring-black/5 hover:ring-brand/40'
                }`}
              >
                <div className="flex-1">
                  <p className="font-semibold">{h.name}</p>
                  <p className="text-sm text-ink-muted">
                    ★ {h.rating} · {t('wizard.fromHaram', { distance: h.distanceToHaramM.toLocaleString('en') })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-bold text-brand">
                    {t('wizard.perNight', { price: formatSAR(h.pricePerNightSAR, i18n.language) })}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {t('wizard.estimate', { price: formatSAR(h.pricePerNightSAR * nights * rooms, i18n.language) })}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-secondary">{t('common.back')}</button>
        <button type="button" onClick={onNext} disabled={!form.hotelId} className="btn-primary">{t('common.next')}</button>
      </div>
    </div>
  );
}

function ReviewStep({ form, onBack }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lang = i18n.language;

  const payload = {
    city: form.city,
    startDate: form.startDate,
    endDate: form.endDate,
    people: Number(form.people),
    hotelId: form.hotelId,
  };

  useEffect(() => {
    api
      .post('/trips/quote', payload)
      .then((res) => setQuote(res.data))
      .catch((err) => setError(errorMessage(err, t('common.error'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/trips', payload);
      navigate(`/trips/${res.data.trip._id}`);
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
      setSaving(false);
    }
  };

  const Row = ({ label, children, strong }) => (
    <div className={`flex justify-between gap-4 py-2 ${strong ? 'text-lg font-bold text-brand' : ''}`}>
      <dt className={strong ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {!quote && !error && <p className="text-ink-muted">{t('common.loading')}</p>}
      {quote && (
        <dl className="divide-y divide-black/5">
          <Row label={t('wizard.city')}>{t(`cities.${form.city}`)}</Row>
          <Row label={t('wizard.hotel')}>{quote.hotel.name}</Row>
          <Row label={t('wizard.dates')}>
            {formatDate(form.startDate, lang)} – {formatDate(form.endDate, lang)} ({t('dashboard.nights', { count: quote.nights })})
          </Row>
          <Row label={t('wizard.people')}>
            {t('dashboard.people', { count: form.people })} · {t('wizard.rooms', { count: quote.rooms })}
            <span className="block text-xs text-ink-muted">{t('wizard.roomsNote')}</span>
          </Row>
          <Row label={t('wizard.subtotal')}>
            {formatSAR(quote.subtotalSAR, lang)}
            <span className="block text-xs text-ink-muted">
              {t('wizard.calc', { nights: quote.nights, price: formatSAR(quote.pricePerNightSAR, lang), rooms: quote.rooms })}
            </span>
          </Row>
          <Row label={t('wizard.vat')}>{formatSAR(quote.vatSAR, lang)}</Row>
          <Row label={t('wizard.total')} strong>{formatSAR(quote.totalCostSAR, lang)}</Row>
        </dl>
      )}
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-secondary">{t('common.back')}</button>
        <button type="button" onClick={save} disabled={!quote || saving} className="btn-primary">
          {saving ? t('common.loading') : t('wizard.confirm')}
        </button>
      </div>
    </div>
  );
}

export default function NewTrip() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ city: 'Makkah', startDate: '', endDate: '', people: 2, hotelId: '' });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold text-brand">{t('wizard.title')}</h1>
      <div className="card">
        <Stepper step={step} />
        {step === 0 && <DetailsStep form={form} setForm={setForm} onNext={() => setStep(1)} />}
        {step === 1 && <HotelStep form={form} setForm={setForm} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {step === 2 && <ReviewStep form={form} onBack={() => setStep(1)} />}
      </div>
    </div>
  );
}
