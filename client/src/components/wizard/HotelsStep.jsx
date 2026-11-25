import { useTranslation } from 'react-i18next';
import { Loading, OptionButton } from '../ui';
import { WizardNav } from './common';
import { formatDate, formatSAR, nightsBetween } from '../../utils/format';

/** Step 3: one hotel per stay, filtered to that stay's city. */
export default function HotelsStep({ form, update, hotels, onBack, onNext }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rooms = Math.ceil(form.people / 2);
  const choose = (i, hotelId) => update({ stays: form.stays.map((s, j) => (j === i ? { ...s, hotelId } : s)) });

  if (!hotels) return <Loading />;

  return (
    <div className="space-y-6">
      {form.stays.map((s, i) => {
        const list = hotels.filter((h) => h.city === s.city);
        const nights = nightsBetween(s.checkIn, s.checkOut);
        return (
          <section key={i}>
            <h3 className="mb-2 font-semibold text-brand">
              {t('wizard.stay', { n: i + 1 })} · {t('wizard.chooseHotelFor', { city: t(`cities.${s.city}`) })}
              <span className="ms-2 text-sm font-normal text-ink-muted">
                {formatDate(s.checkIn, lang)} – {formatDate(s.checkOut, lang)}
              </span>
            </h3>
            {list.length === 0 && <p className="text-ink-muted">{t('wizard.noHotels')}</p>}
            <ul className="grid gap-2">
              {list.map((h) => (
                <li key={h._id}>
                  <OptionButton selected={s.hotelId === h._id} onClick={() => choose(i, h._id)} className="flex w-full flex-wrap items-center gap-3 p-3">
                    <div className="flex-1">
                      <p className="font-semibold">{lang === 'ar' ? h.nameAr : h.name}</p>
                      <p className="text-sm text-ink-muted">
                        ★ {h.rating} · {t('wizard.fromHaram', { distance: h.distanceToHaramM.toLocaleString('en') })}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-brand">{t('wizard.perNight', { price: formatSAR(h.pricePerNightSAR, lang) })}</p>
                      <p className="text-xs text-ink-muted">{t('wizard.estimate', { price: formatSAR(h.pricePerNightSAR * nights * rooms, lang) })}</p>
                    </div>
                  </OptionButton>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <WizardNav onBack={onBack} onNext={onNext} nextDisabled={!form.stays.every((s) => s.hotelId)} />
    </div>
  );
}
