import Icon from './Icon';

/** Horizontal pill tabs. tabs: [{ key, label, icon?, badge? }]. Icons stand in for the label on a phone. */
export default function Tabs({ tabs, active, onChange }) {
  return (
    <nav role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map(({ key, label, icon, badge }) => (
        <button
          key={key}
          role="tab"
          type="button"
          aria-selected={active === key}
          aria-label={label}
          title={label}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${
            active === key ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-brand/15 hover:bg-brand-light'
          }`}
        >
          {icon && <Icon name={icon} className="h-4 w-4" />}
          <span className={icon ? 'hidden sm:inline' : undefined}>{label}</span>
          {badge > 0 && <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs text-white">{badge}</span>}
        </button>
      ))}
    </nav>
  );
}
