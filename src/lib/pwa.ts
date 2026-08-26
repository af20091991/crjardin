// Manifest-only installability. No service worker = no offline caching.
// Older published versions did register a service worker with asset caching;
// actively remove it so stale bundles cannot keep crashing the app after deploys.
export function registerPwa() {
  if (typeof window === "undefined") return;

  const cleanupFlag = "cr-pro-pwa-cache-cleaned-v1";
  let unregisteredServiceWorker = false;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        unregisteredServiceWorker = registrations.length > 0;
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if (navigator.serviceWorker.controller && !sessionStorage.getItem(cleanupFlag)) {
          sessionStorage.setItem(cleanupFlag, "1");
          window.location.reload();
        }
      })
      .catch(() => undefined);
  }

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => {
        if (unregisteredServiceWorker && !sessionStorage.getItem(cleanupFlag)) {
          sessionStorage.setItem(cleanupFlag, "1");
          window.location.reload();
        }
      })
      .catch(() => undefined);
  }
}
