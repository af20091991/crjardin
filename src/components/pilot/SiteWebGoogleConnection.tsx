import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  getSiteWebConnection,
  startGoogleConnection,
  type SiteWebProvider,
} from "@/lib/site-web-api";

const providers: Array<{ id: SiteWebProvider; label: string }> = [
  { id: "google_search_console", label: "Search Console" },
  { id: "google_analytics_4", label: "Analytics 4" },
  { id: "google_business_profile", label: "Business Profile" },
];

/**
 * Traduit les codes d'erreur techniques renvoyés par l'API en messages
 * compréhensibles par un utilisateur non technique, avec une action suggérée
 * quand c'est pertinent. Les codes inconnus affichent un message générique
 * plutôt que le code brut.
 */
export function friendlyConnectionError(code: string | null): string | null {
  if (!code) return null;
  const known: Record<string, string> = {
    google_token_unavailable:
      'La connexion Google a expiré. Cliquez sur "Reconnecter Google" pour la rétablir.',
    google_oauth_not_configured:
      "La connexion Google n'est pas encore configurée pour ce site. Contactez le support.",
    unauthorized: "Votre session Pilot Pro a expiré. Rechargez la page et reconnectez-vous.",
    invalid_or_expired_state:
      "La demande de connexion Google a expiré avant d'être finalisée. Réessayez.",
    token_exchange_failed:
      'Google a refusé la connexion. Cliquez sur "Reconnecter Google" pour réessayer.',
    token_storage_failed:
      "La connexion Google a réussi mais n'a pas pu être enregistrée. Réessayez dans un instant.",
    search_console_sites_failed:
      "Impossible de récupérer la liste des sites Search Console. Vérifiez que le site est bien validé dans Google Search Console.",
    search_console_analytics_failed:
      "Les statistiques Search Console sont temporairement indisponibles. Réessayez dans quelques minutes.",
    analytics_properties_failed:
      "Impossible de récupérer les propriétés Google Analytics. Vérifiez l'accès du compte connecté.",
    analytics_report_failed:
      "Le rapport Google Analytics est temporairement indisponible. Réessayez dans quelques minutes.",
    business_profile_accounts_failed:
      "Impossible de récupérer les comptes Google Business Profile. L'accès à cette API est peut-être encore en cours de validation par Google.",
    business_profile_locations_failed:
      "Impossible de récupérer les fiches établissement Google Business Profile.",
    business_profile_performance_failed:
      "Les statistiques Google Business Profile sont temporairement indisponibles. Réessayez dans quelques minutes.",
    internal_error:
      "Une erreur technique inattendue est survenue. Réessayez, et contactez le support si cela persiste.",
  };
  return (
    known[code] ??
    "Impossible de vérifier cette source Google pour le moment. Réessayez dans quelques instants."
  );
}

export function SiteWebGoogleConnection() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Record<SiteWebProvider, string>>({
    google_search_console: "disconnected",
    google_analytics_4: "disconnected",
    google_business_profile: "disconnected",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const settled = await Promise.allSettled(
      providers.map(async ({ id }) => {
        const result = await getSiteWebConnection(id);
        return {
          id,
          status: result.error ? "error" : (result.data?.status ?? "disconnected"),
          error: result.error,
        };
      }),
    );

    const results = settled.map((entry, index) => {
      if (entry.status === "fulfilled") return entry.value;
      return {
        id: providers[index].id,
        status: "error",
        error: "connection_check_failed",
      };
    });

    setStatus(
      Object.fromEntries(
        results.map(({ id, status: providerStatus }) => [id, providerStatus]),
      ) as Record<SiteWebProvider, string>,
    );

    const firstError = results.find((result) => result.error)?.error ?? null;
    setError(friendlyConnectionError(firstError));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setError("Connexion Pilot Pro requise pour connecter Google.");
      return;
    }
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("site_web_google");
    const reason = params.get("reason");
    if (result === "error") {
      setError(friendlyConnectionError(reason) ?? "La connexion Google a échoué.");
    }
    if (result === "connected") void refresh();
  }, [authLoading, user]);

  const connect = async () => {
    if (!user) {
      setError("Connexion Pilot Pro requise pour connecter Google.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await startGoogleConnection("google_search_console");
      if (result.error || !result.data?.authorization_url) {
        setError(
          friendlyConnectionError(result.error) ?? "Impossible de démarrer la connexion Google.",
        );
        return;
      }
      const authorizationUrl = new URL(result.data.authorization_url);
      authorizationUrl.searchParams.set("prompt", "select_account consent");
      window.location.assign(authorizationUrl.toString());
    } finally {
      setLoading(false);
    }
  };

  const connected = status.google_search_console === "connected";
  const hasConnectionError = providers.some(({ id }) => status[id] === "error");

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-base font-semibold">Sources Google</h2>
              <Badge
                variant="outline"
                className={
                  connected
                    ? "border-emerald-500/40 bg-emerald-500/10 font-normal text-emerald-700"
                    : hasConnectionError
                      ? "border-destructive/40 bg-destructive/10 font-normal text-destructive"
                      : "font-normal text-muted-foreground"
                }
              >
                {connected
                  ? "Source vérifiée"
                  : hasConnectionError
                    ? "Connexion en erreur"
                    : "À connecter"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Une seule autorisation Google alimente Search Console, Analytics 4 et Business
              Profile.
            </p>
          </div>
        </div>
        {/* Le bouton reste actif même une fois connecté : une reconnexion doit
            toujours être possible sans intervention technique si un token
            expire ou qu'une erreur survient. */}
        <Button
          type="button"
          size="sm"
          variant={connected ? "outline" : "default"}
          onClick={connect}
          disabled={authLoading || loading || !user}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : connected ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {connected ? "Reconnecter Google" : "Connecter Google"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {providers.map(({ id, label }) => {
          const providerStatus = status[id];
          const verified = providerStatus === "connected";
          const errored = providerStatus === "error";
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                verified
                  ? "bg-emerald-500/10 text-emerald-700"
                  : errored
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted/40 text-muted-foreground"
              }`}
            >
              {verified ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              )}
              {label}
              {verified ? " · vérifiée" : errored ? " · erreur" : " · non connectée"}
            </span>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </Card>
  );
}
