// Manifest-only installability. No service worker = no offline caching.
// Older published versions did register a service worker with asset caching;
// actively remove it so stale bundles cannot keep crashing the app after deploys.
export function registerPwa() {
  if (typeof window === "undefined") return;

  const cleanupFlag = "cr-pro-pwa-cache-cleaned-v1";
  const shouldReloadOnce = () => {
    if (sessionStorage.getItem(cleanupFlag)) return false;
    sessionStorage.setItem(cleanupFlag, "1");
    return true;
  };
  const isAppCache = (name: string) =>
    name === "html-cache" ||
    name === "asset-cache" ||
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.allSettled(registrations.map((registration) => registration.update()));
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));

        if ((registrations.length > 0 || navigator.serviceWorker.controller) && shouldReloadOnce()) {
          window.location.reload();
        }
      })
      .catch(() => undefined);
  }

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => Promise.allSettled(keys.filter(isAppCache).map((key) => caches.delete(key))))
      .catch(() => undefined);
  }
}
