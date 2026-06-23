/// <reference types="google.maps" />
/** Charge l'API Google Maps JS (une seule fois) avec la clé navigateur Lovable. */
let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) return Promise.reject(new Error("Clé Google Maps indisponible"));

  loaderPromise = new Promise((resolve, reject) => {
    const cbName = "__initGoogleMaps__";
    (window as unknown as Record<string, unknown>)[cbName] = () => resolve(window.google);
    const script = document.createElement("script");
    const params = new URLSearchParams({ key, loading: "async", callback: cbName, libraries: "places" });
    if (channel) params.set("channel", channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Échec du chargement de Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}
