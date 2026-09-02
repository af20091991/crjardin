import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export function SiteWebGoogleConnection() {
  const [status, setStatus] = useState<Record<SiteWebProvider, string>>({
    google_search_console: "disconnected",
    google_analytics_4: "disconnected",
    google_business_profile: "disconnected",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const results = await Promise.all(
      providers.map(async ({ id }) => {
        const result = await getSiteWebConnection(id);
        return {
          id,
          status: result.error ? "error" : result.data?.status ?? "disconnected",
          error: result.error,
        };
      }),
    );

    setStatus(
      Object.fromEntries(
        results.map(({ id, status: providerStatus }) => [id, providerStatus]),
      ) as Record<SiteWebProvider, string>,
    );

    const firstError = results.find((result) => result.error)?.error;
    if (firstError) setError(firstError);
  };

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("site_web_google");
    const reason = params.get("reason");
    if (result === "error") {
      setError(
        reason
          ? `La connexion Google a échoué : ${reason}.`
          : "La connexion Google a échoué.",
      );
    }
    if (result === "connected") void refresh();
  }, []);

  const connect = async () => {
    setLoading(true);
    setError(null);
    const result = await startGoogleConnection("google_search_console");
    setLoading(false);
    if (result.error || !result.data?.authorization_url) {
      setError(result.error ?? "Impossible de démarrer la connexion Google.");
      return;
    }
    window.location.assign(result.data.authorization_url);
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
              <h2 className="font-serif text-base font-semibold">
                Sources Google
              </h2>
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
              Une seule autorisation Google alimente Search Console, Analytics
              4 et Business Profile.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={connect}
          disabled={loading || connected}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {connected ? "Google connecté" : "Connecter Google"}
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
              {verified
                ? " · vérifiée"
                : errored
                  ? " · erreur"
                  : " · non connectée"}
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
