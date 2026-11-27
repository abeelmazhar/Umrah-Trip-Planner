import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import { Alert, Field, Loading, Section } from '../components/ui';
import { formatDate } from '../utils/format';

function CreateGroupForm({ trips }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', leaderPhone: '', tripId: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/groups', { ...form, tripId: form.tripId || undefined });
      navigate(`/groups/${res.data._id}?tab=members`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field id="g-name" label={t('groups.name')}>
        <input id="g-name" required maxLength={80} className="input" placeholder={t('groups.namePlaceholder')} value={form.name} onChange={set('name')} />
      </Field>
      <Field id="g-phone" label={t('groups.leaderPhone')}>
        <input id="g-phone" type="tel" dir="ltr" className="input" placeholder={t('groups.phonePlaceholder')} value={form.leaderPhone} onChange={set('leaderPhone')} />
      </Field>
      <Field id="g-trip" label={t('groups.linkTrip')}>
        <select id="g-trip" className="input" value={form.tripId} onChange={set('tripId')}>
          <option value="">{t('groups.noTrip')}</option>
          {trips?.map((trip) => (
            <option key={trip._id} value={trip._id}>
              {trip.title || trip.insights.route.map((c) => t(`cities.${c}`)).join(' → ')} · {formatDate(trip.startDate)}
            </option>
          ))}
        </select>
      </Field>
      <Alert>{error}</Alert>
      <button type="submit" className="btn-primary w-full">{t('groups.create')}</button>
    </form>
  );
}

function JoinGroupForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) navigate(`/join/${encodeURIComponent(code.trim())}`);
      }}
    >
      <Field id="g-code" label={t('groups.code')}>
        <input id="g-code" required dir="ltr" className="input font-mono uppercase tracking-widest" placeholder={t('groups.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <button type="submit" className="btn-gold w-full">{t('groups.join')}</button>
    </form>
  );
}

export default function Groups() {
  const { t } = useTranslation();
  const { data: groups, error, loading } = useFetch('/groups');
  const { data: trips } = useFetch('/trips');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand sm:text-3xl">{t('groups.title')}</h1>
        <p className="text-sm text-ink-muted">{t('groups.subtitle')}</p>
      </div>
      <Alert>{error}</Alert>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {loading && <Loading title={false} cards={1} />}
          {groups?.length === 0 && <div className="card text-center text-ink-muted">{t('groups.empty')}</div>}
          {groups?.map((g) => (
            <Link key={g._id} to={`/groups/${g._id}`} className="card block border-s-4 border-accent transition hover:ring-brand/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-brand">{g.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.isLeader ? 'bg-accent text-brand-dark' : 'bg-brand-light text-brand'}`}>
                  {g.isLeader ? t('groups.leader') : t('groups.member')}
                </span>
              </div>
              <p className="text-sm text-ink-muted">
                {t('groups.members', { count: g.membersCount })}
                {g.sharingCount > 0 && ` · 📍 ${t('groups.sharing', { count: g.sharingCount })}`}
              </p>
              {g.nextMeetingPoint && (
                <p className="mt-1 text-sm">
                  📌 {t('groups.next')}: <b>{g.nextMeetingPoint.place}</b> · {g.nextMeetingPoint.title}
                </p>
              )}
            </Link>
          ))}
        </div>
        <div className="space-y-5 lg:col-span-2">
          <Section title={t('groups.join')}>
            <JoinGroupForm />
          </Section>
          <Section title={t('groups.create')}>
            <CreateGroupForm trips={trips} />
          </Section>
        </div>
      </div>
    </div>
  );
}
