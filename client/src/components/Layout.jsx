import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { AssistantDrawerProvider, useAssistantDrawer } from '../context/AssistantDrawerContext';
import AssistantDrawer from './AssistantDrawer';
import LanguageSwitcher from './LanguageSwitcher';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
  }`;

export default function Layout() {
  return (
    <AssistantDrawerProvider>
      <LayoutShell />
    </AssistantDrawerProvider>
  );
}

function LayoutShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { open, toggleDrawer } = useAssistantDrawer();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = user ? (
    <>
      <NavLink to="/" end className={navClass}>{t('nav.dashboard')}</NavLink>
      <NavLink to="/groups" className={navClass}>{t('nav.groups')}</NavLink>
      <NavLink to="/settings/notifications" className={navClass}>{t('nav.reminders')}</NavLink>
      <NavLink to="/trips/new" className={navClass}>{t('nav.newTrip')}</NavLink>
      <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-2 text-start text-sm text-white/80 hover:bg-white/10 hover:text-white">
        {t('nav.logout')}
      </button>
    </>
  ) : (
    <>
      <NavLink to="/login" className={navClass}>{t('nav.login')}</NavLink>
      <NavLink to="/register" className={navClass}>{t('nav.register')}</NavLink>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print islamic-pattern border-b-4 border-accent bg-brand text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-base font-bold sm:text-lg">
            <img src="/kaaba.svg" alt="" className="h-8 w-8 shrink-0 rounded-md ring-1 ring-accent/60" />
            <span className="truncate">{t('app.name')}</span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">{links}</nav>
            <LanguageSwitcher />
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? t('assistant.close') : t('nav.menu')}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-nav" className="mx-auto flex max-w-5xl flex-col gap-1 px-3 pb-3 md:hidden">
            {links}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
      <footer className="no-print px-3 py-6 text-center text-xs text-ink-muted">{t('app.tagline')}</footer>
      {user && (
        <>
          {!open && (
            <button
              type="button"
              className="no-print fixed end-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-dark"
              onClick={toggleDrawer}
              aria-expanded={false}
              aria-label={t('nav.assistant')}
            >
              <span aria-hidden="true">💬</span>
              <span className="hidden sm:inline">{t('nav.assistant')}</span>
            </button>
          )}
          <AssistantDrawer />
        </>
      )}
    </div>
  );
}
