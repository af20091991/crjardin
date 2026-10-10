import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteWebCompetitorDetails } from "@/components/pilot/SiteWebCompetitorDetails";
import {
  addCompetitor,
  checkCompetitor,
  listCompetitors,
  removeCompetitor,
  type Competitor,
} from "@/lib/site-web-competitors.functions";

export function SiteWebCompetitorWatch() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const messageOf = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

  const load = async () => {
    setLoading(true);
    try {
      setCompetitors(await listCompetitors());
      setError(null);
    } catch (err) {
      setError(messageOf(err, "Impossible de charger les concurrents."));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !domain.trim()) return;
    setAdding(true);
    try {
      await addCompetitor({ data: { name, domain } });
      setName("");
      setDomain("");
      await load();
    } catch (err) {
      setError(messageOf(err, "Ajout impossible pour le moment."));
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await removeCompetitor({ data: { id } });
      await load();
    } catch (err) {
      setError(messageOf(err, "Suppression impossible pour le moment."));
    }
  };

  const handleCheck = async (id: string) => {
    setCheckingId(id);
    try {
      const lastCheck = await checkCompetitor({ data: { id } });
      setCompetitors((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, previousCheck: c.lastCheck ?? c.previousCheck, lastCheck } : c,
        ),
      );
      setOpenId(id);
      setError(null);
    } catch (err) {
      setError(messageOf(err, "Analyse impossible pour le moment."));
    }
    setCheckingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Nom du concurrent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="sm:max-w-[200px]"
        />
        <Input
          placeholder="exemple.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="sm:max-w-[200px]"
        />
        <Button size="sm" onClick={handleAdd} disabled={adding || !name.trim() || !domain.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : competitors.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun concurrent suivi pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {competitors.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.domain}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCheck(c.id)}
                    disabled={checkingId === c.id}
                  >
                    {checkingId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleRemove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {c.lastCheck ? (
                <>
                  {c.lastCheck.error && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{friendlyCheckError(c.lastCheck.error)}</span>
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <ScoreBadge
                      label="Performance"
                      value={c.lastCheck.performance_score}
                      previous={c.previousCheck?.performance_score ?? null}
                    />
                    <ScoreBadge
                      label="SEO"
                      value={c.lastCheck.seo_score}
                      previous={c.previousCheck?.seo_score ?? null}
                    />
                    <ScoreBadge
                      label="Accessibilité"
                      value={c.lastCheck.accessibility_score}
                      previous={c.previousCheck?.accessibility_score ?? null}
                    />
                    <ScoreBadge
                      label="Bonnes pratiques"
                      value={c.lastCheck.best_practices_score}
                      previous={c.previousCheck?.best_practices_score ?? null}
                    />
                    <Badge variant="outline" className="font-normal">
                      {c.lastCheck.ssl_ok ? (
                        <ShieldCheck className="mr-1 h-3 w-3 text-emerald-600" />
                      ) : (
                        <ShieldX className="mr-1 h-3 w-3 text-destructive" />
                      )}
                      {c.lastCheck.ssl_ok ? "SSL valide" : "SSL invalide ou injoignable"}
                    </Badge>
                    {c.lastCheck.response_time_ms != null && (
                      <Badge variant="outline" className="font-normal">
                        Réponse {c.lastCheck.response_time_ms} ms
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Analysé le {new Date(c.lastCheck.checked_at).toLocaleString("fr-FR")}
                      </p>
                      {isCheckStale(c.lastCheck.checked_at) && (
                        <Badge variant="outline" className="border-amber-500/40 font-normal text-amber-700">
                          À actualiser
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    >
                      {openId === c.id ? "Masquer le détail" : "Voir le détail"}
                      {openId === c.id ? (
                        <ChevronUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  {openId === c.id && <SiteWebCompetitorDetails check={c.lastCheck} />}
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pas encore analysé : clique sur l'icône d'actualisation.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isCheckStale(checkedAt: string) {
  const timestamp = new Date(checkedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
}

function friendlyCheckError(error: string) {
  if (/quota/i.test(error) && /pagespeed/i.test(error)) {
    return "Quota PageSpeed atteint : les scores de performance, SEO et accessibilité n’ont pas pu être actualisés. Réessaie après le renouvellement du quota.";
  }
  if (/HTTP 524|timeout|timed out/i.test(error)) {
    return "Le service d’analyse a mis trop de temps à répondre. Réessaie plus tard ; cette tentative n’a pas actualisé les scores PageSpeed.";
  }
  return error;
}

function ScoreBadge({
  label,
  value,
  previous,
}: {
  label: string;
  value: number | null;
  previous: number | null;
}) {
  if (value == null) return null;
  const tone =
    value >= 90 ? "text-emerald-600" : value >= 50 ? "text-amber-600" : "text-destructive";
  const delta = previous == null ? 0 : value - previous;
  return (
    <Badge variant="outline" className="font-normal">
      {label} <span className={`ml-1 font-semibold ${tone}`}>{value}</span>
      {delta !== 0 && (
        <span
          className={`ml-1 ${delta > 0 ? "text-emerald-600" : "text-destructive"}`}
          title="Évolution depuis l'analyse précédente"
        >
          {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
        </span>
      )}
    </Badge>
  );
}
