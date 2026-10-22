// Registers the service worker (sw.js): a script the browser runs in the
// background that keeps copies of Mindle's files, so the game works offline.
// Browsers only allow this on https:// or on your own computer (localhost / 127.0.0.1).

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('Offline mode is not available:', error);
    });
  });
}
