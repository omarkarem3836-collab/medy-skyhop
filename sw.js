// Bump this revision whenever any file in APP_SHELL changes. Each installed
// worker serves one complete revision until its open game windows are closed.
const REVISION = '2026-10-14-progressive-flight-v4';
const SCOPE = new URL(self.registration.scope);
const ROOT_URL = SCOPE.href;
const CACHE_PREFIX = `medy-skyhop:${SCOPE.pathname}:shell:`;
const CACHE_NAME = `${CACHE_PREFIX}${REVISION}`;
const APP_SHELL = [
  './',
  './styles.css',
  './destinations.css',
  './install.css',
  './app.js',
  './engine.js',
  './renderer.js',
  './scenery.js',
  './palette.js',
  './destinations.js',
  './install.js',
  './manifest.webmanifest',
  './assets/ExpoArabic-Bold.otf',
  './assets/ExpoArabic-Medium.ttf',
  './assets/medsky-airways-logo-white.svg',
  './assets/medsky-airways-logo.svg',
  './assets/medy-flying-right.png',
  './assets/medy-flying-cutout.png',
  './assets/app-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
].map(path => new URL(path, SCOPE).href);
const SHELL_URLS = new Set(APP_SHELL);
const INDEX_URL = new URL('./index.html', SCOPE).href;

async function installShell() {
  // Fetch the whole revision before storing it. Redirects must fail rather
  // than accidentally saving a sign-in page in place of the public game.
  const files = await Promise.all(APP_SHELL.map(async url => {
    const response = await fetch(new Request(url, {
      cache: 'reload', credentials: 'same-origin', redirect: 'error',
    }));
    const isHTML = (response.headers.get('content-type') || '').includes('text/html');
    if (!response.ok || response.redirected || response.type === 'opaque' ||
        (url !== ROOT_URL && isHTML)) {
      throw new Error(`The game could not be saved for offline play: ${new URL(url).pathname}`);
    }
    return [url, response];
  }));

  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(files.map(([url, response]) => cache.put(url, response)));
  } catch (error) {
    // A quota/storage error must not leave a partial offline revision behind.
    try { await caches.delete(CACHE_NAME); } catch { /* Storage can be unavailable. */ }
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(installShell());
  // No skipWaiting: an update must never replace a game during a flight.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name)));
    } catch { /* Cache cleanup is optional; the live game should still work. */ }
    await self.clients.claim();
  })());
});

async function shellResponse(request, url) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(url);
    if (saved) return saved;
  } catch { /* Use the network if browser storage is unavailable. */ }
  return fetch(request);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin) return;

  // Only the app's two document URLs and its exact static file list belong to
  // this worker. Authentication, API routes and unknown paths stay untouched.
  const canonicalURL = `${url.origin}${url.pathname}`;
  const isDocument = canonicalURL === ROOT_URL || canonicalURL === INDEX_URL;
  if (event.request.mode === 'navigate') {
    if (!isDocument) return;
    event.respondWith(shellResponse(event.request, ROOT_URL));
  } else if (SHELL_URLS.has(canonicalURL)) {
    event.respondWith(shellResponse(event.request, canonicalURL));
  }
});
