// Service worker: appen går att lägga på hemskärmen och fungerar offline. Hämtar alltid från nätet först
// (så att nya versioner syns direkt) och använder sparade filer bara när nätet saknas.
// Data från Supabase cachas inte – spel sparas lokalt i appen och skickas när nät finns.
const CACHE = 'dart-v17';
const FILER = ['./', 'index.html', 'style.css?v=0.10.1', 'app.js?v=0.10.1', 'lib.js?v=0.10.1', 'spel.js?v=0.10.1', 'spela.js?v=0.10.1',
  'historik.js?v=0.10.1', 'statistik.js?v=0.10.1', 'diagram.js?v=0.10.1', 'jag.js?v=0.10.1', 'nyheter.js?v=0.10.1', 'hem.js?v=0.10.1', 'turnering.js?v=0.10.1', 'klubb.js?v=0.10.1', 'sidor.js?v=0.10.1', 'ikon.svg?v=0.10.1', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILER)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;   // bara appens egna filer
  e.respondWith(fetch(e.request).then((svar) => {
    if (svar.ok) { const kopia = svar.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopia)); }
    return svar;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('./'))));
});
