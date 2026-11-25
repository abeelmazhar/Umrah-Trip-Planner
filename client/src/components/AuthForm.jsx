import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../api/client';
import { Alert, Field } from './ui';

/**
 * Shared login / register card.
 *   fields: which inputs to show, e.g. ['name', 'email', 'password']
 *   onSubmit(values): resolves on success, throws on failure
 */
export default function AuthForm({ mode, fields, onSubmit }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [values, setValues] = useState(Object.fromEntries(fields.map((f) => [f, ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
      setBusy(false);
    }
  };

  const input = {
    name: { autoComplete: 'name' },
    email: { type: 'email', dir: 'ltr', autoComplete: 'email' },
    password: { type: 'password', dir: 'ltr', autoComplete: isLogin ? 'current-password' : 'new-password', minLength: isLogin ? undefined : 6 },
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold text-brand">{t(`auth.${mode}Title`)}</h1>
        <p className="mb-6 text-sm text-ink-muted">{t(`auth.${mode}Subtitle`)}</p>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((f) => (
            <Field key={f} id={f} label={t(`auth.${f}`)} hint={f === 'password' && !isLogin ? t('auth.passwordHint') : null}>
              <input id={f} required className="input" value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })} {...input[f]} />
            </Field>
          ))}
          <Alert>{error}</Alert>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.loading') : t(`auth.${mode}Button`)}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-muted">
          {t(isLogin ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
          {/* Keep `state.from` so a join link survives switching between login and sign-up. */}
          <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-semibold text-brand hover:underline">
            {t(isLogin ? 'nav.register' : 'nav.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
