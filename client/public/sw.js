/* Plain service worker (not part of the Vite build). Handles Web Push. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Umrah Trip Planner';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: Boolean(data.urgent),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open && 'focus' in open) {
        if (typeof open.navigate === 'function') return open.navigate(target).then((client) => client && client.focus());
        return open.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
