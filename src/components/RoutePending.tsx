/**
 * Affiché pendant que le routeur vérifie la session (premier démarrage mobile, réseau lent) :
 * évite un écran vide entre le splash et le Dashboard.
 */
export function RoutePending() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
