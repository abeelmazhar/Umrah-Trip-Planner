import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { errorMessage } from '../api/client';
import useFetch from '../hooks/useFetch';
import { Alert, Loading, Section } from '../components/ui';
import Tabs from '../components/Tabs';
import QrCode from '../components/group/QrCode';
import LostCardView from '../components/group/LostCardView';
import MembersTab from '../components/group/MembersTab';
import MeetingTab from '../components/group/MeetingTab';
import SettingsTab from '../components/group/SettingsTab';

const REFRESH_MS = 20000; // members' live locations

function InviteCard({ group, setGroup, setError }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join/${group.code}`;

  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const newCode = async () => {
    if (!window.confirm(t('groups.newCodeConfirm'))) return;
    try {
      const { data } = await api.post(`/groups/${group._id}/code`);
      setGroup((g) => ({ ...g, code: data.code }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Section title={t('groups.invite')}>
      <div className="flex flex-wrap items-center gap-4">
        <QrCode value={link} size={112} label={t('groups.invite')} />
        <div className="space-y-2">
          <p className="text-xs text-ink-muted">{t('groups.inviteDesc')}</p>
          <p dir="ltr" className="font-mono text-3xl font-bold tracking-[0.3em] text-brand">{group.code}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary !py-1" onClick={copy}>{copied ? t('common.copied') : t('groups.copyLink')}</button>
            {group.isLeader && <button type="button" className="btn-secondary !py-1" onClick={newCode}>{t('groups.newCode')}</button>}
          </div>
        </div>
      </div>
    </Section>
  );
}

function CardTab({ group }) {
  const { t } = useTranslation();
  const url = `${window.location.origin}/lost/${group.myCard.cardToken}`;
  return (
    <div className="space-y-4">
      <p className="no-print text-center text-sm text-ink-muted">{t('groups.card.desc')}</p>
      <LostCardView card={group.myCard} qrUrl={url} />
      <div className="no-print flex justify-center gap-2">
        <button type="button" className="btn-gold" onClick={() => window.print()}>🖨️ {t('groups.card.print')}</button>
        <a className="btn-secondary" href={url} target="_blank" rel="noreferrer">{t('groups.card.open')}</a>
      </div>
    </div>
  );
}

const TABS = { members: MembersTab, meeting: MeetingTab, card: CardTab, settings: SettingsTab };

export default function GroupDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'members';
  const { data: group, setData: setGroup, error, setError, loading, reload } = useFetch(`/groups/${id}`);

  // Refresh quietly so members' locations and new meeting points appear without reloading.
  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === 'visible' && reload({ silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  if (loading) return <Loading />;
  if (!group) {
    return (
      <div className="card text-center">
        <p className="mb-4">{error}</p>
        <Link to="/groups" className="btn-secondary">{t('common.back')}</Link>
      </div>
    );
  }

  const Panel = TABS[tab];
  const hotel = group.hotel;

  return (
    <div className="space-y-5">
      <div className="no-print grid gap-5 lg:grid-cols-5">
        <header className="card border-s-4 border-accent lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">
            {group.isLeader ? t('groups.leader') : t('groups.member')} · {t('groups.members', { count: group.members.length })}
          </p>
          <h1 className="text-2xl font-bold text-brand">{group.name}</h1>
          <p className="mt-2 text-sm">
            🏨 {t('groups.hotelToday')}:{' '}
            {hotel ? (
              <b>
                {i18n.language === 'ar' ? hotel.nameAr : hotel.name} · {t(`cities.${hotel.city}`)}
              </b>
            ) : (
              <span className="text-ink-muted">{t('groups.noHotel')}</span>
            )}
          </p>
          {group.meetingPoints[0] && (
            <p className="mt-1 text-sm">
              📌 {t('groups.next')}: <b>{group.meetingPoints[0].place}</b> · {group.meetingPoints[0].title}
            </p>
          )}
        </header>
        <div className="lg:col-span-2">
          <InviteCard group={group} setGroup={setGroup} setError={setError} />
        </div>
      </div>

      <Alert className="no-print">{error}</Alert>

      <div className="no-print">
        <Tabs
          tabs={Object.keys(TABS).map((key) => ({ key, label: t(`groups.tabs.${key}`) }))}
          active={tab}
          onChange={(key) => setParams({ tab: key }, { replace: true })}
        />
      </div>
      <div role="tabpanel">
        <Panel group={group} setGroup={setGroup} setError={setError} reload={reload} />
      </div>
    </div>
  );
}
