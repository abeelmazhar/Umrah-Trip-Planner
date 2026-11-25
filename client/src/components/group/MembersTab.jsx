import { useTranslation } from 'react-i18next';
import { Alert, Section } from '../ui';
import useLocationSharing from '../../hooks/useLocationSharing';
import { distanceMeters, formatDistance, mapsUrl, timeAgo } from '../../utils/geo';

const SHARE_MINUTES = [15, 30, 60, 120];

function LocationControl({ sharing, t, lang }) {
  const { active, until, start, stop, error } = sharing;
  const errorText = error.startsWith('geo:') ? t(error === 'geo:denied' ? 'groups.geoDenied' : 'groups.geoUnavailable') : error;
  return (
    <Section title={`📍 ${t('groups.shareTitle')}`}>
      <p className="mb-3 text-sm text-ink-muted">{t('groups.shareDesc')}</p>
      {active ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-semibold text-brand">
            {t('groups.sharingUntil', { time: until.toLocaleTimeString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) })}
          </span>
          <button type="button" className="btn-danger" onClick={stop}>{t('groups.stopSharing')}</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SHARE_MINUTES.map((m) => (
            <button key={m} type="button" className="btn-secondary" onClick={() => start(m)}>
              {t('groups.shareFor', { minutes: m })}
            </button>
          ))}
        </div>
      )}
      <Alert className="mt-3">{errorText}</Alert>
      <p className="mt-3 text-xs text-ink-muted">🔒 {t('groups.privacy')}</p>
    </Section>
  );
}

export default function MembersTab({ group, reload }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const sharing = useLocationSharing(group._id, group.mySharing?.until, reload);
  const me = sharing.myPosition;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Section title={t('groups.members', { count: group.members.length })} className="lg:col-span-3">
        <ul className="divide-y divide-black/5">
          {group.members.map((m) => (
            <li key={m._id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-light font-bold text-brand">{m.displayName.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {m.displayName}
                  {m.isMe && <span className="ms-1 text-xs font-normal text-ink-muted">({t('groups.you')})</span>}
                  {m.role === 'leader' && <span className="ms-2 rounded-full bg-accent px-2 py-0.5 text-[11px] text-brand-dark">{t('groups.leader')}</span>}
                </p>
                {m.location ? (
                  <p className={`text-xs ${m.location.stale ? 'text-amber-800' : 'text-brand'}`}>
                    📍 {t('groups.lastSeen', { time: timeAgo(m.location.updatedAt, lang) })}
                    {m.location.stale && ` · ${t('groups.stale')}`}
                    {me && !m.isMe && ` · ${t('groups.distanceFromYou', { distance: formatDistance(distanceMeters(me, m.location), lang) })}`}{' '}
                    · <a className="underline" href={mapsUrl(m.location)} target="_blank" rel="noreferrer">{t('groups.openMap')}</a>
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">{t('groups.notSharing')}</p>
                )}
              </div>
              {m.phone && !m.isMe && (
                <a href={`tel:${m.phone.replace(/[^\d+]/g, '')}`} className="btn-secondary !px-3 !py-1" dir="ltr">
                  📞 {t('groups.callLabel')}
                </a>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <div className="lg:col-span-2">
        <LocationControl sharing={sharing} t={t} lang={lang} />
      </div>
    </div>
  );
}
