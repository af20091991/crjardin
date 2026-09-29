import { useEffect, useState, type ReactElement } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getWordPressOverview,
  type WordPressCollection,
  type WordPressOverview,
} from "@/lib/site-web-wordpress.functions";
import {
  getWordPressAdminOverview,
  type HealthStatus,
  type WordPressAdminOverview,
} from "@/lib/site-web-wordpress-admin.functions";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function SiteWebWordPress() {
  const [overview, setOverview] = useState<WordPressOverview | null>(null);
  const [admin, setAdmin] = useState<WordPressAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Séquentiel : évite d'envoyer trop de requêtes d'un coup au site (limites anti-bot).
      const publicOverview = await getWordPressOverview();
      setOverview(publicOverview);
      const adminOverview = await getWordPressAdminOverview().catch(() => null);
      setAdmin(adminOverview);
    } catch {
      setError("Impossible de lire le site WordPress pour le moment.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Suivi WordPress</h2>
          <p className="text-sm text-muted-foreground">
            Lecture des données publiques du site : disponibilité, articles et pages.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Actualiser
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {overview && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={overview.reachable ? "default" : "destructive"}>
                {overview.reachable ? "API WordPress joignable" : "API WordPress non détectée"}
              </Badge>
              {overview.responseTimeMs != null && (
                <Badge variant="outline" className="font-normal">
                  {overview.responseTimeMs} ms
                </Badge>
              )}
              {overview.siteName && <span className="font-medium">{overview.siteName}</span>}
              <a
                href={overview.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                {overview.siteUrl.replace("https://", "")}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            {overview.siteDescription && (
              <p className="mt-2 text-sm text-muted-foreground">{overview.siteDescription}</p>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <CollectionCard title="Articles" collection={overview.posts} />
            <CollectionCard title="Pages" collection={overview.pages} />
          </div>

          {admin?.configured ? (
            admin.error ? (
              <Card className="p-4">
                <p className="text-sm text-destructive">{admin.error}</p>
              </Card>
            ) : (
              <WordPressAdminSection admin={admin} />
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Les mises à jour de plugins et le diagnostic de santé WordPress nécessitent un mot de
              passe d'application WordPress (non configuré).
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CollectionCard({ title, collection }: { title: string; collection: WordPressCollection }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" />
          {title}
        </h3>
        {collection.total != null && (
          <Badge variant="outline" className="font-normal">
            {collection.total} au total
          </Badge>
        )}
      </div>
      {collection.error ? (
        <p className="text-sm text-destructive">{collection.error}</p>
      ) : collection.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun contenu publié.</p>
      ) : (
        <ul className="space-y-2">
          {collection.items.map((item) => (
            <li key={item.id} className="text-sm">
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="font-medium hover:underline"
              >
                {item.title}
              </a>
              <p className="text-xs text-muted-foreground">
                Modifié le {formatDate(item.modified)} · publié le {formatDate(item.date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const HEALTH_ICON: Record<HealthStatus, ReactElement> = {
  good: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  recommended: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  critical: <ShieldAlert className="h-4 w-4 text-destructive" />,
  unknown: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
};

const HEALTH_LABEL: Record<HealthStatus, string> = {
  good: "Bon",
  recommended: "À améliorer",
  critical: "Critique",
  unknown: "Inconnu",
};

function WordPressAdminSection({ admin }: { admin: WordPressAdminOverview }) {
  const updatesAvailable = admin.plugins.filter((plugin) => plugin.updateAvailable).length;
  const criticalHealth = admin.health.filter((test) => test.status === "critical").length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={admin.core.updateAvailable ? "destructive" : "default"}>
            WordPress {admin.core.installedVersion ?? "?"}
          </Badge>
          {admin.core.updateAvailable && admin.core.latestVersion && (
            <span className="text-xs text-muted-foreground">
              Mise à jour disponible : {admin.core.latestVersion}
            </span>
          )}
          {admin.theme && (
            <Badge variant="outline" className="font-normal">
              Thème : {admin.theme.name} {admin.theme.version}
            </Badge>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Santé du site{" "}
          {criticalHealth > 0 && (
            <span className="text-destructive">({criticalHealth} critique(s))</span>
          )}
        </h3>
        <ul className="space-y-2">
          {admin.health.map((test) => (
            <li key={test.id} className="flex items-start gap-2">
              {HEALTH_ICON[test.status]}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {test.label}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({HEALTH_LABEL[test.status]})
                  </span>
                </p>
                {test.description && (
                  <p className="text-xs text-muted-foreground">{test.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" />
          Extensions ({admin.plugins.length})
          {updatesAvailable > 0 && (
            <Badge variant="destructive">{updatesAvailable} mise(s) à jour</Badge>
          )}
        </h3>
        {admin.plugins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune extension détectée.</p>
        ) : (
          <ul className="space-y-1.5">
            {admin.plugins.map((plugin) => (
              <li key={plugin.slug} className="flex items-center justify-between gap-2 text-sm">
                <span className={plugin.active ? "" : "text-muted-foreground"}>
                  {plugin.name}
                  {!plugin.active && " (désactivée)"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {plugin.version}
                  {plugin.updateAvailable && plugin.latestVersion && (
                    <span className="ml-1 font-medium text-destructive">
                      → {plugin.latestVersion}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
