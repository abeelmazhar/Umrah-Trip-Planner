import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../../api/client';
import usePushNotifications from '../../hooks/usePushNotifications';
import { Field, Section } from '../ui';
import Icon from '../Icon';

function MeetingForm({ groupId, onSaved, onError }) {
  const { t } = useTranslation();
  const empty = { title: '', place: '', time: '', note: '' };
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      // datetime-local has no time zone: convert from the phone's local time to ISO.
      const time = form.time ? new Date(form.time).toISOString() : undefined;
      const res = await api.post(`/groups/${groupId}/meeting-points`, { ...form, time });
      onSaved(res.data);
      setForm(empty);
    } catch (err) {
      onError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field id="m-title" label={t('groups.meeting.title')}>
        <input id="m-title" required maxLength={80} className="input" placeholder={t('groups.meeting.titlePlaceholder')} value={form.title} onChange={set('title')} />
      </Field>
      <Field id="m-place" label={t('groups.meeting.place')}>
        <input id="m-place" required maxLength={120} className="input" placeholder={t('groups.meeting.placePlaceholder')} value={form.place} onChange={set('place')} />
      </Field>
      <Field id="m-time" label={t('groups.meeting.time')} optional>
        <input id="m-time" type="datetime-local" className="input" value={form.time} onChange={set('time')} />
      </Field>
      <Field id="m-note" label={t('groups.meeting.note')} optional>
        <input id="m-note" maxLength={200} className="input" value={form.note} onChange={set('note')} />
      </Field>
      <button type="submit" className="btn-primary w-full">{t('groups.meeting.add')}</button>
    </form>
  );
}

export default function MeetingTab({ group, setGroup, setError }) {
  const { t, i18n } = useTranslation();
  const { subscribed } = usePushNotifications();
  const fmt = (d) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(d));

  const remove = async (id) => {
    try {
      setGroup((await api.delete(`/groups/${group._id}/meeting-points/${id}`)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Section title={t('groups.tabs.meeting')} className="lg:col-span-3">
        {group.meetingPoints.length === 0 && <p className="text-sm text-ink-muted">{t('groups.meeting.empty')}</p>}
        <ul className="space-y-2">
          {group.meetingPoints.map((p, i) => {
            const past = p.time && new Date(p.time) < new Date();
            return (
              <li key={p._id} className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${i === 0 && !past ? 'bg-accent-light ring-accent' : 'ring-brand/10'} ${past ? 'opacity-60' : ''}`}>
                <span className="text-xl" aria-hidden="true">📌</span>
                <div className="flex-1">
                  <p className="font-bold text-brand">{p.place}</p>
                  <p className="text-sm">{p.title}{p.note && ` · ${p.note}`}</p>
                  <p className="text-xs text-ink-muted">{p.time ? fmt(p.time) : t('groups.meeting.anytime')}{past && ` · ${t('groups.meeting.past')}`}</p>
                  {p.time && !past && subscribed === true && (
                    <p className="mt-1 text-xs text-brand">{t('notifications.meetingHint')}</p>
                  )}
                  {p.time && !past && subscribed === false && (
                    <Link to="/settings/notifications" className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">
                      {t('notifications.turnOn')}
                    </Link>
                  )}
                </div>
                {group.isLeader && (
                  <button type="button" className="rounded-lg p-1.5 text-red-700 hover:bg-red-50" onClick={() => remove(p._id)} aria-label={t('common.delete')} title={t('common.delete')}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      {group.isLeader && (
        <Section title={t('groups.meeting.add')} className="lg:col-span-2">
          <MeetingForm groupId={group._id} onSaved={setGroup} onError={setError} />
        </Section>
      )}
    </div>
  );
}
