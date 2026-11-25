import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMeta from '../hooks/useMeta';
import useFetch from '../hooks/useFetch';
import { Loading } from '../components/ui';
import { Stepper } from '../components/wizard/common';
import BasicsStep from '../components/wizard/BasicsStep';
import ItineraryStep from '../components/wizard/ItineraryStep';
import HotelsStep from '../components/wizard/HotelsStep';
import TransportStep from '../components/wizard/TransportStep';
import ReviewStep from '../components/wizard/ReviewStep';

const STEP_COMPONENTS = [BasicsStep, ItineraryStep, HotelsStep, TransportStep, ReviewStep];

const INITIAL_FORM = {
  title: '',
  people: 2,
  originRegion: 'south-asia',
  homeCurrency: 'PKR',
  stays: [
    { city: 'Madinah', checkIn: '', checkOut: '', hotelId: '' },
    { city: 'Makkah', checkIn: '', checkOut: '', hotelId: '' },
  ],
  transferModes: [],
};

/** 5-step wizard. All answers live in one state object here, so "Back" never loses anything. */
export default function NewTrip() {
  const { t } = useTranslation();
  const meta = useMeta();
  const { data: hotels } = useFetch('/hotels');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const go = (n) => () => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };
  const Step = STEP_COMPONENTS[step];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold text-brand">{t('wizard.title')}</h1>
      <div className="card">
        <Stepper step={step} />
        {meta ? (
          <Step
            form={form}
            update={update}
            meta={meta}
            hotels={hotels}
            onBack={step > 0 ? go(step - 1) : undefined}
            onNext={step < STEP_COMPONENTS.length - 1 ? go(step + 1) : undefined}
          />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}
