// Offline support: app shell cached on install, word data network-first, audio cache-first.
const SHELL = "shell-v1", AUDIO = "audio-v1", DATA = "data-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, AUDIO, DATA].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/audio/")) {               // audio never changes for a given file name
    e.respondWith(caches.open(AUDIO).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (url.pathname.includes("/data/")) {                // fresh words when online, last copy offline
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const cl = r.clone(); caches.open(DATA).then(c => c.put(e.request, cl)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  e.respondWith(fetch(e.request).then(r => {             // app shell: network first so updates show up
    if (r.ok) { const cl = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cl)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(h => h || caches.match("./index.html"))));
});
