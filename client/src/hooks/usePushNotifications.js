import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';

/** VAPID public key (base64url) → the bytes PushManager.subscribe expects. */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** iPhone Safari only delivers Web Push from a Home Screen icon (iOS 16.4+). */
export function iosNeedsHomeScreen() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return ios && !standalone;
}

/**
 * Push on this device. Permission is requested only when subscribe() is called.
 * `subscribed` is null until we know whether this browser already has a subscription.
 */
export default function usePushNotifications() {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
  const [permission, setPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'default' : Notification.permission
  ));
  const [subscribed, setSubscribed] = useState(null);

  useEffect(() => {
    if (!supported) {
      setSubscribed(false);
      return undefined;
    }
    let cancel = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancel) setSubscribed(Boolean(sub)); })
      .catch(() => { if (!cancel) setSubscribed(false); });
    return () => { cancel = true; };
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) {
      const err = new Error('unsupported');
      err.code = 'unsupported';
      throw err;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next !== 'granted') {
      const err = new Error('denied');
      err.code = 'denied';
      throw err;
    }
    const { data } = await api.get('/notifications/vapid-public-key');
    await navigator.serviceWorker.register('/sw.js');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }
    const json = sub.toJSON();
    await api.post('/notifications/subscribe', { endpoint: json.endpoint, keys: json.keys });
    setSubscribed(true);
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe();
    if (endpoint) await api.post('/notifications/unsubscribe', { endpoint });
    setSubscribed(false);
  }, [supported]);

  const sendTest = useCallback(async () => {
    const { data } = await api.post('/notifications/test');
    return data;
  }, []);

  return {
    supported,
    permission,
    subscribed,
    subscribe,
    unsubscribe,
    sendTest,
    iosNeedsInstall: iosNeedsHomeScreen(),
  };
}
