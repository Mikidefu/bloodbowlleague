// Service worker della companion: SOLO notifiche push.
// Di proposito niente cache e niente gestione di 'fetch': il sito arriva sempre fresco dalla rete,
// così un aggiornamento non resta mai bloccato dietro una versione vecchia salvata sul telefono.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Safari (iPhone) toglie il permesso se un push non mostra una notifica: lì si mostra sempre
const isWebKit = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|Android/.test(self.navigator.userAgent);

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    // Con la companion aperta e visibile l'avviso compare già dentro l'app: niente doppione
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.some(w => w.visibilityState === 'visible' && new URL(w.url).pathname.startsWith('/companion'));
    if (open && !isWebKit) return;
    await self.registration.showNotification(data.title || 'BBL Companion', {
      body: data.body || '',
      tag: data.tag,
      icon: '/companion-icons/icon-192.png',
      badge: '/companion-icons/icon-192.png',
      vibrate: data.tone === 'neutral' ? undefined : [200, 100, 200],
      data: { url: data.url || '/companion' },
    });
  })());
});

// Toccando la notifica si torna alla partita: nella finestra già aperta, se c'è
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/companion', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = windows.find(w => w.url === url) || windows.find(w => new URL(w.url).pathname.startsWith('/companion'));
    if (same) {
      await same.focus();
      if (same.url !== url && 'navigate' in same) await same.navigate(url);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
