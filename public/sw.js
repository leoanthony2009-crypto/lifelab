// Life Lab service worker — caches the app shell and static scenario content ONLY.
// Never caches: /api/*, /.netlify/*, /teacher*, identity tokens. Pupil events are queued in
// IndexedDB-free localStorage by the client (see src/api.js) and replayed when back online.
const VERSION = 'life-lab-v5';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-32.png', '/icons/icon-64.png', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/teacher')) return;
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone())); return res; }).catch(() => hit || caches.match('/index.html'));
    return hit || net;
  }));
});
