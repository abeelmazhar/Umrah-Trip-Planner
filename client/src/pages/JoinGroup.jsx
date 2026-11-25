import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import { Alert, Field } from '../components/ui';

/** Opened from an invite link or QR code: /join/K7P2QM */
export default function JoinGroup() {
  const { code } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const display = code.toUpperCase();

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/groups/join', { code, phone });
      navigate(`/groups/${res.data._id}?tab=card`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={join} className="card mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-brand">{t('groups.joinTitle', { code: display })}</h1>
      <p className="text-sm text-ink-muted">{t('groups.joinDesc')}</p>
      <Field id="j-phone" label={t('groups.phone')} optional>
        <input id="j-phone" type="tel" dir="ltr" className="input" placeholder={t('groups.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <p className="text-xs text-ink-muted">🔒 {t('groups.privacy')}</p>
      <Alert>{error}</Alert>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? t('common.loading') : t('groups.joinButton')}
      </button>
    </form>
  );
}
