/* global self */
self.addEventListener('install', () => {
  // Keep the service worker as a benign placeholder to avoid 404s in dev.
  // No push logic is implemented here.
  self.skipWaiting();
});
self.addEventListener('activate', () => {
  self.clients.claim();
});
