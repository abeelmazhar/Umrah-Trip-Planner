/** Horizontal pill tabs. tabs: [{ key, label, badge? }] */
export default function Tabs({ tabs, active, onChange }) {
  return (
    <nav role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map(({ key, label, badge }) => (
        <button
          key={key}
          role="tab"
          type="button"
          aria-selected={active === key}
          onClick={() => onChange(key)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            active === key ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-brand/15 hover:bg-brand-light'
          }`}
        >
          {label}
          {badge > 0 && <span className="ms-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs text-white">{badge}</span>}
        </button>
      ))}
    </nav>
  );
}
