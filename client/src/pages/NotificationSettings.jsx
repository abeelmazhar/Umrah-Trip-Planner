import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import usePushNotifications from '../hooks/usePushNotifications';
import { Alert, Field, Loading, OptionButton, Section } from '../components/ui';

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-3 border-b border-brand/10 py-3 last:border-0">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-brand"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function NotificationSettings() {
  const { t } = useTranslation();
  const push = usePushNotifications();
  const { data, error, loading } = useFetch('/notifications/preferences');
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState('success');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.notificationPrefs) setForm(data.notificationPrefs);
  }, [data]);

  const note = (kind, text) => {
    setStatusKind(kind);
    setStatus(text);
  };

  const enable = async () => {
    setBusy(true);
    note('info', '');
    try {
      await push.subscribe();
      note('success', t('notifications.on'));
    } catch (err) {
      if (err.code !== 'denied' && err.code !== 'unsupported') note('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await push.unsubscribe();
      note('success', t('notifications.disable'));
    } catch (err) {
      note('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: saved } = await api.put('/notifications/preferences', form);
      setForm(saved.notificationPrefs);
      note('success', t('notifications.saved'));
    } catch (err) {
      note('error', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      await push.sendTest();
      note('success', t('notifications.testSent'));
    } catch (err) {
      note('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePrayer = (name) => {
    const has = form.prayer.prayers.includes(name);
    const prayers = has ? form.prayer.prayers.filter((p) => p !== name) : [...form.prayer.prayers, name];
    setForm({ ...form, prayer: { ...form.prayer, prayers } });
  };

  if (loading && !form) return <Loading />;
  if (!form) return <Alert>{error || t('common.error')}</Alert>;

  const canAsk = push.supported && !push.iosNeedsInstall && push.permission !== 'denied';

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-brand">{t('notifications.title')}</h1>
      <p className="text-sm text-ink-muted">{t('notifications.why')}</p>

      {push.iosNeedsInstall && <Alert kind="warning">{t('notifications.ios')}</Alert>}
      {!push.iosNeedsInstall && !push.supported && <Alert kind="warning">{t('notifications.unsupported')}</Alert>}
      {!push.iosNeedsInstall && push.supported && push.permission === 'denied' && (
        <Alert kind="error">{t('notifications.denied')}</Alert>
      )}
      {status && <Alert kind={statusKind}>{status}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Section title={t('notifications.enable')}>
        {push.subscribed ? (
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-sm">{t('notifications.on')}</p>
            <button type="button" className="btn-secondary" onClick={disable} disabled={busy}>{t('notifications.disable')}</button>
            <button type="button" className="btn-primary" onClick={sendTest} disabled={busy}>{t('notifications.test')}</button>
          </div>
        ) : (
          <button type="button" className="btn-primary" onClick={enable} disabled={!canAsk || busy}>
            {t('notifications.enable')}
          </button>
        )}
      </Section>

      <Section title={t('notifications.types')}>
        <Toggle label={t('notifications.master')} checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />
        <Toggle label={t('notifications.meetings')} checked={form.meetingPoints} onChange={(meetingPoints) => setForm({ ...form, meetingPoints })} />
        <Toggle label={t('notifications.transfers')} checked={form.transfers} onChange={(transfers) => setForm({ ...form, transfers })} />
        <Toggle label={t('notifications.checkOut')} checked={form.checkOut} onChange={(checkOut) => setForm({ ...form, checkOut })} />
        <Toggle label={t('notifications.passport')} checked={form.passport} onChange={(passport) => setForm({ ...form, passport })} />
        <Toggle label={t('notifications.nusuk')} checked={form.nusukPermit} onChange={(nusukPermit) => setForm({ ...form, nusukPermit })} />
        <Toggle
          label={t('notifications.prayer')}
          hint={t('notifications.prayerHint')}
          checked={form.prayer.enabled}
          onChange={(enabled) => setForm({ ...form, prayer: { ...form.prayer, enabled } })}
        />
        {form.prayer.enabled && (
          <div className="space-y-3 py-3">
            <div className="flex flex-wrap gap-2">
              {PRAYERS.map((name) => (
                <OptionButton
                  key={name}
                  selected={form.prayer.prayers.includes(name)}
                  onClick={() => togglePrayer(name)}
                  className="px-3 py-2 text-sm"
                >
                  {t(`prayers.${name}`)}
                </OptionButton>
              ))}
            </div>
            <Field id="minutes-before" label={t('notifications.minutesBefore')}>
              <input
                id="minutes-before"
                type="number"
                min={0}
                max={120}
                className="input w-28"
                value={form.prayer.minutesBefore}
                onChange={(e) => setForm({
                  ...form,
                  prayer: { ...form.prayer, minutesBefore: Number(e.target.value) },
                })}
              />
            </Field>
          </div>
        )}
        <Toggle
          label={t('notifications.quiet')}
          hint={t('notifications.quietHint')}
          checked={form.quietHours.enabled}
          onChange={(enabled) => setForm({ ...form, quietHours: { ...form.quietHours, enabled } })}
        />
        {form.quietHours.enabled && (
          <div className="grid grid-cols-2 gap-3 py-3">
            <Field id="quiet-start" label={t('notifications.quietStart')}>
              <input
                id="quiet-start"
                type="time"
                className="input"
                value={form.quietHours.start}
                onChange={(e) => setForm({ ...form, quietHours: { ...form.quietHours, start: e.target.value.slice(0, 5) } })}
              />
            </Field>
            <Field id="quiet-end" label={t('notifications.quietEnd')}>
              <input
                id="quiet-end"
                type="time"
                className="input"
                value={form.quietHours.end}
                onChange={(e) => setForm({ ...form, quietHours: { ...form.quietHours, end: e.target.value.slice(0, 5) } })}
              />
            </Field>
          </div>
        )}
        <button type="button" className="btn-primary mt-4" onClick={save} disabled={saving}>{t('notifications.save')}</button>
      </Section>
    </div>
  );
}
