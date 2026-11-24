import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع' },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user, setUser } = useAuth();

  const change = (code) => {
    if (code === i18n.language) return;
    i18n.changeLanguage(code);
    // Remember the choice on the account too (best effort).
    if (user) {
      api
        .patch('/auth/me', { preferredLanguage: code })
        .then((res) => setUser(res.data.user))
        .catch(() => {});
    }
  };

  return (
    <div role="group" aria-label={t('common.language')} className="flex rounded-lg bg-black/20 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          lang={o.code}
          onClick={() => change(o.code)}
          aria-pressed={i18n.language === o.code}
          className={`min-w-9 rounded-md px-2 py-1 text-xs font-bold transition ${
            i18n.language === o.code ? 'bg-accent text-brand-dark' : 'text-white/80 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
