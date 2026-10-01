/* Service Worker push HUB DIGI — relais des notifs in-app (bugs, tickets, mails…).
   Enregistré par src/lib/push.js. Scope racine : fichier servi à /push-sw.js. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'HUB DIGI', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'HUB DIGI';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/logo/logo-digi-com.png',
      badge: '/favicon-96x96.png',
      data: { url: data.url || '/notifications/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    }),
  );
});
