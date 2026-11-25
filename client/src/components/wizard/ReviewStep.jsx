import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';
import MiqatCard from '../MiqatCard';
import { Alert, Loading } from '../ui';
import { WizardNav } from './common';
import { formatDate, formatMoney, formatSAR } from '../../utils/format';
import { transfersNeeded } from '../../utils/itinerary';

function Row({ label, children, strong, sub }) {
  return (
    <div className={`flex justify-between gap-4 py-2 ${strong ? 'text-lg font-bold text-brand' : ''}`}>
      <dt className={strong ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-end">
        {children}
        {sub && <span className="block text-xs font-normal text-ink-muted">{sub}</span>}
      </dd>
    </div>
  );
}

/** Step 5: the server prices the itinerary (same function as when saving), then "Save trip". */
export default function ReviewStep({ form, onBack }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-5">
      <Alert>{error}</Alert>
      {!quote && !error && <Loading />}
      {quote && (
        <>
          <dl className="divide-y divide-black/5">
            {quote.stays.map((s, i) => (
              <Row
                key={i}
                label={`${t('wizard.stay', { n: i + 1 })} · ${t(`cities.${s.city}`)}`}
                sub={`${formatDate(s.checkIn, lang)} – ${formatDate(s.checkOut, lang)} · ${t('wizard.calc', { nights: s.nights, price: formatSAR(s.pricePerNightSAR, lang), rooms: s.rooms })}`}
              >
                <span className="font-medium">{lang === 'ar' ? s.hotel?.nameAr : s.hotel?.name}</span> · {formatSAR(s.subtotalSAR, lang)}
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
            <Row
              label={t('wizard.total')}
              strong
              sub={form.homeCurrency !== 'SAR' ? t('wizard.inYourCurrency', { amount: formatMoney(quote.homeCurrency.totalCost, form.homeCurrency, lang) }) : null}
            >
              {formatSAR(quote.totalCostSAR, lang)}
            </Row>
          </dl>
          {quote.warnings.includes('noMakkahStay') && <Alert kind="warning">{t('wizard.noMakkahWarning')}</Alert>}
          <MiqatCard miqat={quote.miqat} />
        </>
      )}
      <WizardNav onBack={onBack} onNext={save} nextDisabled={!quote || saving} nextLabel={saving ? t('common.loading') : t('wizard.confirm')} />
    </div>
  );
}
