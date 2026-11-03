/**
 * Aperçu en lecture seule (onglet Administration → Vues).
 *
 * Actif uniquement lorsque la page est affichée dans un cadre (iframe) nommé « pp-apercu » :
 * l'administrateur voit ce que voit le client sans jamais pouvoir modifier de donnée.
 * Le verrou est double : côté navigateur (requêtes d'écriture bloquées) et côté serveur
 * (en-tête « x-apercu » contrôlé par chaque fonction d'écriture).
 */
export const APERCU_FRAME_NAME = "pp-apercu";
export const APERCU_HEADER = "x-apercu";

// Appels RPC de lecture autorisés même en aperçu (tous les autres sont bloqués).
const READ_RPC = /^(get_|has_|is_|list_|can_|check_)/;

let installed = false;

export function isApercu(): boolean {
  try {
    return window.self !== window.top && window.name === APERCU_FRAME_NAME;
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function blockedResponse(): Response {
  return new Response(
    JSON.stringify({
      message: "Aperçu en lecture seule : aucune modification n'est enregistrée.",
      code: "APERCU_READ_ONLY",
    }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

function showBanner() {
  if (document.getElementById("pp-apercu-banner")) return;
  const bar = document.createElement("div");
  bar.id = "pp-apercu-banner";
  bar.textContent = "Aperçu lecture seule — rien n'est enregistré";
  bar.setAttribute(
    "style",
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:4px 8px;text-align:center;font:600 12px system-ui,sans-serif;background:#EE8627;color:#1f1f1f;",
  );
  document.body.appendChild(bar);
}

/** À appeler une fois, au démarrage du navigateur. Sans effet hors aperçu. */
export function installApercuGuard() {
  if (installed || typeof window === "undefined" || !isApercu()) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = requestMethod(input, init);

    if (url.includes("/rest/v1/") && method !== "GET" && method !== "HEAD") {
      const rpc = url.match(/\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)/);
      if (!(rpc && READ_RPC.test(rpc[1]))) return Promise.resolve(blockedResponse());
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set(APERCU_HEADER, "1");
    return originalFetch(input, { ...init, headers });
  };

  const addBanner = () => showBanner();
  if (document.body) addBanner();
  else document.addEventListener("DOMContentLoaded", addBanner);
}
