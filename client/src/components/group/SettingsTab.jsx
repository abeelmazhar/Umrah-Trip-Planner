import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../hooks/useFetch';
import { Field, Section } from '../ui';
import Icon from '../Icon';

function LeaderSettings({ group, setGroup, setError }) {
  const { t } = useTranslation();
  const { data: trips } = useFetch('/trips');
  const [form, setForm] = useState({ name: group.name, leaderPhone: group.leaderPhone, tripId: group.tripId || '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      setGroup((await api.patch(`/groups/${group._id}`, { ...form, tripId: form.tripId || null })).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Section title={t('groups.settings.saveGroup')}>
      <form onSubmit={save} className="space-y-3">
        <Field id="s-name" label={t('groups.name')}>
          <input id="s-name" required maxLength={80} className="input" value={form.name} onChange={set('name')} />
        </Field>
        <Field id="s-phone" label={t('groups.leaderPhone')}>
          <input id="s-phone" type="tel" dir="ltr" className="input" value={form.leaderPhone} onChange={set('leaderPhone')} />
        </Field>
        <Field id="s-trip" label={t('groups.linkTrip')}>
          <select id="s-trip" className="input" value={form.tripId} onChange={set('tripId')}>
            <option value="">{t('groups.noTrip')}</option>
            {trips?.map((trip) => (
              <option key={trip._id} value={trip._id}>
                {trip.title || trip.insights.route.map((c) => t(`cities.${c}`)).join(' → ')}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className="btn-primary w-full">{t('common.save')}</button>
      </form>
    </Section>
  );
}

function MyDetails({ group, setGroup, setError }) {
  const { t } = useTranslation();
  const me = group.members.find((m) => m.isMe);
  const [form, setForm] = useState({ displayName: me.displayName, phone: me.phone });
  const save = async (e) => {
    e.preventDefault();
    try {
      setGroup((await api.patch(`/groups/${group._id}/me`, form)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Section title={t('groups.settings.myDetails')}>
      <form onSubmit={save} className="space-y-3">
        <Field id="me-name" label={t('auth.name')}>
          <input id="me-name" required maxLength={80} className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </Field>
        <Field id="me-phone" label={t('groups.phone')} optional>
          <input id="me-phone" type="tel" dir="ltr" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <button type="submit" className="btn-primary w-full">{t('groups.settings.saveMe')}</button>
      </form>
    </Section>
  );
}

export default function SettingsTab({ group, setGroup, setError, reload }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = group.members.find((m) => m.isMe);

  const act = async (confirmText, request, after) => {
    if (!window.confirm(confirmText)) return;
    try {
      await request();
      after();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        {group.isLeader && <LeaderSettings group={group} setGroup={setGroup} setError={setError} />}
        <MyDetails group={group} setGroup={setGroup} setError={setError} />
      </div>
      <div className="space-y-5">
        {group.isLeader && (
          <Section title={t('groups.members', { count: group.members.length })}>
            <ul className="divide-y divide-black/5">
              {group.members.filter((m) => !m.isMe).map((m) => (
                <li key={m._id} className="flex items-center justify-between py-2 text-sm">
                  {m.displayName}
                  <button type="button" className="rounded-lg p-1.5 text-red-700 hover:bg-red-50" aria-label={t('groups.settings.remove')} title={t('groups.settings.remove')}
                    onClick={() => act(t('groups.settings.removeConfirm', { name: m.displayName }), () => api.delete(`/groups/${group._id}/members/${m._id}`), reload)}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <div className="card">
          {group.isLeader ? (
            <button type="button" className="btn-danger w-full"
              onClick={() => act(t('groups.settings.deleteConfirm'), () => api.delete(`/groups/${group._id}`), () => navigate('/groups'))}>
              {t('groups.settings.deleteGroup')}
            </button>
          ) : (
            <button type="button" className="btn-danger w-full"
              onClick={() => act(t('groups.settings.leaveConfirm'), () => api.delete(`/groups/${group._id}/members/${me._id}`), () => navigate('/groups'))}>
              {t('groups.settings.leave')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
