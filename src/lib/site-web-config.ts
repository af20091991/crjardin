/**
 * Configuration unique du module Site web : site de l'entreprise et propriété GA4 par défaut.
 * Tout composant doit importer ces valeurs ici plutôt que les redéclarer.
 */
export const SITE_WEB_SITE_URL = "https://www.delagraineaujardin.com/";
export const SITE_WEB_SITE_HOST = "delagraineaujardin.com";
/** Propriété GA4 du site, utilisée tant qu'aucun autre choix n'a été mémorisé. */
export const SITE_WEB_DEFAULT_GA4_PROPERTY_ID = "159443253";
export const SITE_WEB_GA4_STORAGE_KEY = "pp-site-web-ga4-property";

export function readSavedGa4Property(): string | null {
  try {
    return window.localStorage.getItem(SITE_WEB_GA4_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveGa4Property(id: string): void {
  try {
    window.localStorage.setItem(SITE_WEB_GA4_STORAGE_KEY, id);
  } catch {
    /* préférence facultative */
  }
}
