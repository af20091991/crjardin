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
      providers.map(
        async ({ id }) =>
          [id, (await getSiteWebConnection(id)).data?.status ?? "disconnected"] as const,
      ),
    );
    setStatus(Object.fromEntries(results) as Record<SiteWebProvider, string>);
  };

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("site_web_google");
    if (result === "error") {
      setError(params.get("message") ?? "La connexion Google a échoué.");
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
              <Badge variant="outline" className="font-normal">
                {connected ? "Connecté" : "À connecter"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Une seule autorisation Google alimente Search Console, Analytics 4 et Business Profile.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={connect} disabled={loading || connected}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {connected ? "Google connecté" : "Connecter Google"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {providers.map(({ id, label }) => (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-xs"
          >
            {status[id] === "connected" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            )}
            {label}
          </span>
        ))}
      </div>

      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </Card>
  );
}
