// Mindle's service worker: a script the browser runs in the background,
// between the page and the internet. It keeps copies of Mindle's files so the
// game still works with no connection (and when added to a phone's home screen).
//
// Strategy: "network first". When online, every file is fetched fresh (so new
// entries and code changes show up straight away) and the saved copy is updated.
// When offline, or if the network takes too long, the saved copy is used instead.
//
// If you add a new file to the game, add it to FILES and change VERSION,
// so phones download a full fresh set.

const VERSION = 'mindle-v1';
const FILES = [
  './',
  'index.html',
  'encyclopedia.html',
  'style.css',
  'data.json',
  'manifest.webmanifest',
  'js/app.js',
  'js/logic.js',
  'js/storage.js',
  'js/dom.js',
  'js/pwa.js',
  'js/encyclopedia.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];
const NETWORK_TIMEOUT = 4000; // ms to wait for the network before using the saved copy

// Installing: save a copy of every file.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Activating: delete copies saved by older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Every request the page makes passes through here. Requests to other websites
// (like the GoatCounter visit counter) are left alone, so they're never cached.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await withTimeout(fetch(request.url, { cache: 'no-cache' }), NETWORK_TIMEOUT);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Offline or too slow: use the saved copy. ignoreSearch lets "index.html?x" match "index.html".
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    if (request.mode === 'navigate') return cache.match('index.html');
    return Response.error();
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
