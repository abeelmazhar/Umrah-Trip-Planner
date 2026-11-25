import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';
import { getPosition } from '../utils/geo';

const SEND_EVERY_MS = 30000;

/**
 * Live-location sharing for one group.
 *  - start(minutes): ask permission, send the first position with the duration
 *  - while sharing and the page is open: watch the position and send it at most every 30 s
 *  - stop(): tell the server to forget the position
 * The server also switches sharing off when the time is up.
 */
export default function useLocationSharing(groupId, initialUntil, onChange) {
  const [until, setUntil] = useState(initialUntil ? new Date(initialUntil) : null);
  const [error, setError] = useState('');
  const [myPosition, setMyPosition] = useState(null);
  const lastSent = useRef(0);
  const active = Boolean(until && until > new Date());

  const start = useCallback(
    async (minutes) => {
      setError('');
      try {
        const pos = await getPosition();
        setMyPosition(pos);
        const res = await api.put(`/groups/${groupId}/location`, { ...pos, minutes });
        lastSent.current = Date.now();
        setUntil(new Date(res.data.until));
        onChange?.();
      } catch (err) {
        setError(err.code ? `geo:${err.code}` : errorMessage(err));
      }
    },
    [groupId, onChange]
  );

  const stop = useCallback(async () => {
    setUntil(null);
    try {
      await api.delete(`/groups/${groupId}/location`);
      onChange?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [groupId, onChange]);

  // Keep sending fresh positions while sharing is on.
  useEffect(() => {
    if (!active || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setMyPosition(pos);
        if (Date.now() - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = Date.now();
        api.put(`/groups/${groupId}/location`, pos).catch((err) => {
          if (err.response?.status === 409) setUntil(null); // expired on the server
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    const timer = setTimeout(() => setUntil(null), until - new Date());
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
    };
  }, [active, groupId, until]);

  return { active, until, start, stop, error, myPosition };
}
