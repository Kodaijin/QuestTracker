// QuestTracker service worker — handles Web Push display and click-through.
// Registered by the client (see usePushSubscription). Served at /sw.js (root scope).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'QuestTracker', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'QuestTracker';
  const options = {
    body: data.body || '',
    data: { href: data.href || '/' },
    tag: data.tag,
    renotify: Boolean(data.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(href);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(href);
    }),
  );
});
