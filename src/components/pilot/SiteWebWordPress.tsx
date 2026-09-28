import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getWordPressOverview,
  type WordPressCollection,
  type WordPressOverview,
} from "@/lib/site-web-wordpress.functions";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function SiteWebWordPress() {
  const [overview, setOverview] = useState<WordPressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getWordPressOverview());
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

          <p className="text-xs text-muted-foreground">
            Les mises à jour de plugins et le diagnostic de santé WordPress ne sont pas accessibles
            publiquement : ils nécessitent un mot de passe d'application WordPress (non configuré).
          </p>
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
