import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white'
  }`;

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <img src="/kaaba.svg" alt="" className="h-8 w-8" />
            <span>{t('app.name')}</span>
          </Link>
          <nav className="ms-auto flex items-center gap-1">
            {user ? (
              <>
                <NavLink to="/" end className={navClass}>
                  {t('nav.dashboard')}
                </NavLink>
                <NavLink to="/trips/new" className={navClass}>
                  {t('nav.newTrip')}
                </NavLink>
                <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  {t('nav.login')}
                </NavLink>
                <NavLink to="/register" className={navClass}>
                  {t('nav.register')}
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="py-6 text-center text-xs text-ink-muted">{t('app.tagline')}</footer>
    </div>
  );
}
