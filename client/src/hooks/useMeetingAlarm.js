import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const seen = new Set();

function tagFor(groupId, point, userId) {
  return `meeting:${groupId}:${point._id}:${new Date(point.time).toISOString()}:${userId}`;
}

function clock(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(date));
}

/**
 * While a group page is open, remind locally 5 minutes before the next meeting.
 * Uses the same tag as the server push, so the two don't stack.
 */
export default function useMeetingAlarm(group) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!group || !user) return undefined;
    const now = Date.now();
    const upcoming = (group.meetingPoints || [])
      .filter((point) => point.time && new Date(point.time).getTime() > now)
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    const next = upcoming.find((point) => !seen.has(tagFor(group._id, point, user._id)));
    if (!next) return undefined;

    const tag = tagFor(group._id, next, user._id);
    const fireAt = new Date(next.time).getTime() - 5 * 60 * 1000;
    const delay = Math.min(Math.max(0, fireAt - now), 2147483647);
    let active = true;

    const timer = setTimeout(() => {
      if (!active || seen.has(tag)) return;
      seen.add(tag);
      const title = t('notifications.alarm');
      const note = next.note ? ` · ${next.note}` : '';
      const body = `${t('notifications.alarmBody', {
        title: next.title,
        place: next.place,
        time: clock(next.time),
      })}${note}`;
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const notice = new Notification(title, { body, tag, icon: '/icon-192.png' });
          notice.onclick = () => {
            window.focus();
            notice.close();
          };
        } else if (active) {
          setMessage(`${title}. ${body}`);
        }
      } catch {
        if (active) setMessage(`${title}. ${body}`);
      }
      if (active) setGeneration((n) => n + 1);
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [group, user, t, generation]);

  return message;
}
