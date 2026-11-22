// Service worker: appen går att lägga på hemskärmen och fungerar offline. Hämtar alltid från nätet först
// (så att nya versioner syns direkt) och använder sparade filer bara när nätet saknas.
// Data från Supabase cachas inte – spel sparas lokalt i appen och skickas när nät finns.
const CACHE = 'dart-v11';
const FILER = ['./', 'index.html', 'style.css?v=0.7.3', 'app.js?v=0.7.3', 'lib.js?v=0.7.3', 'spel.js?v=0.7.3', 'spela.js?v=0.7.3',
  'historik.js?v=0.7.3', 'statistik.js?v=0.7.3', 'diagram.js?v=0.7.3', 'jag.js?v=0.7.3', 'nyheter.js?v=0.7.3', 'hem.js?v=0.7.3', 'turnering.js?v=0.7.3', 'klubb.js?v=0.7.3', 'ikon.svg?v=0.7.3', 'manifest.webmanifest'];
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
