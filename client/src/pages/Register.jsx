import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';

export default function Register() {
  const { t, i18n } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({ ...form, preferredLanguage: i18n.language });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold text-brand">{t('auth.registerTitle')}</h1>
        <p className="mb-6 text-sm text-ink-muted">{t('auth.registerSubtitle')}</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">{t('auth.name')}</label>
            <input id="name" autoComplete="name" required className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label" htmlFor="email">{t('auth.email')}</label>
            <input id="email" type="email" dir="ltr" autoComplete="email" required className="input" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label" htmlFor="password">{t('auth.password')}</label>
            <input id="password" type="password" dir="ltr" autoComplete="new-password" minLength={6} required className="input" value={form.password} onChange={set('password')} />
            <p className="mt-1 text-xs text-ink-muted">{t('auth.passwordHint')}</p>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : t('auth.registerButton')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-muted">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">{t('nav.login')}</Link>
        </p>
      </div>
    </div>
  );
}
