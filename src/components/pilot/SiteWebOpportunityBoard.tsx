import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDot, EyeOff, Loader2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { querySearchConsole } from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type Status = "a_traiter" | "en_cours" | "traite" | "ignore";

type WatchlistEntry = {
  entity_key: string;
  status: Status;
  note: string | null;
};

type Opportunity = {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  status: Status;
  note: string;
};

const columns: Array<{ id: Status; label: string; icon: typeof CircleDot }> = [
  { id: "a_traiter", label: "À traiter", icon: CircleDot },
  { id: "en_cours", label: "En cours", icon: Loader2 },
  { id: "traite", label: "Traité", icon: CheckCircle2 },
];

/**
 * Pipeline CRM des opportunités de visibilité : chaque requête à fort
 * potentiel (bien positionnée, peu cliquée) peut être déplacée entre les
 * statuts À traiter / En cours / Traité, et annotée. Le statut et la note
 * sont persistés dans site_web_watchlist (propres à chaque utilisateur),
 * contrairement à une simple liste recalculée à chaque chargement.
 */
export function SiteWebOpportunityBoard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [watchlist, setWatchlist] = useState<Record<string, WatchlistEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      const [searchResult, watchlistResult] = await Promise.all([
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: yearStart(),
          endDate: yesterday(),
          dimensions: ["query"],
        }),
        supabase
          .from("site_web_watchlist")
          .select("entity_key, status, note")
          .eq("entity_type", "query"),
      ]);

      if (!active) return;

      if (searchResult.error) setError(searchResult.error);
      setRows(searchResult.data?.rows ?? []);

      const entries: Record<string, WatchlistEntry> = {};
      for (const entry of watchlistResult.data ?? []) {
        entries[entry.entity_key] = entry as WatchlistEntry;
      }
      setWatchlist(entries);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const opportunities = useMemo<Opportunity[]>(() => {
    return rows
      .filter(
        (row) =>
          Number(row.impressions ?? 0) >= 30 &&
          Number(row.position ?? 99) <= 20 &&
          Number(row.ctr ?? 0) < 0.08,
      )
      .map((row) => {
        const query = row.keys?.[0] ?? "";
        const entry = watchlist[query];
        return {
          query,
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          ctr: Number(row.ctr ?? 0),
          position: Number(row.position ?? 0),
          status: entry?.status ?? "a_traiter",
          note: entry?.note ?? "",
        };
      })
      .sort((a, b) => b.impressions * (0.08 - b.ctr) - a.impressions * (0.08 - a.ctr));
  }, [rows, watchlist]);

  const grouped = useMemo(() => {
    const result: Record<Status, Opportunity[]> = {
      a_traiter: [],
      en_cours: [],
      traite: [],
      ignore: [],
    };
    for (const opportunity of opportunities) {
      result[opportunity.status].push(opportunity);
    }
    return result;
  }, [opportunities]);

  const persist = async (query: string, status: Status, note: string) => {
    if (!user) return;
    setSavingKey(query);
    setWatchlist((current) => ({
      ...current,
      [query]: { entity_key: query, status, note },
    }));
    await supabase.from("site_web_watchlist").upsert(
      {
        user_id: user.id,
        entity_type: "query",
        entity_key: query,
        status,
        note: note || null,
      },
      { onConflict: "user_id,entity_type,entity_key" },
    );
    setSavingKey(null);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Données Google indisponibles : {error}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Pipeline d'opportunités</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Requêtes bien positionnées mais peu cliquées (≥30 impressions, position ≤ 20, CTR &lt;
              8 %). Déplace chaque carte selon son avancement, ajoute une note pour te rappeler
              l'action prévue.
            </p>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Chargement des opportunités…
        </Card>
      ) : opportunities.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucune opportunité détectée sur les données disponibles.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((column) => (
            <div key={column.id} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <column.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="outline" className="ml-auto font-normal">
                  {grouped[column.id].length}
                </Badge>
              </div>
              <div className="space-y-3">
                {grouped[column.id].length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Aucune carte ici.
                  </p>
                ) : (
                  grouped[column.id].map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.query}
                      opportunity={opportunity}
                      saving={savingKey === opportunity.query}
                      onChangeStatus={(status) =>
                        persist(opportunity.query, status, opportunity.note)
                      }
                      onChangeNote={(note) => persist(opportunity.query, opportunity.status, note)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {grouped.ignore.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIgnored((current) => !current)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {showIgnored ? "Masquer" : "Voir"} les {grouped.ignore.length} opportunité(s) ignorée(s)
          </button>
          {showIgnored && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.ignore.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.query}
                  opportunity={opportunity}
                  saving={savingKey === opportunity.query}
                  onChangeStatus={(status) => persist(opportunity.query, status, opportunity.note)}
                  onChangeNote={(note) => persist(opportunity.query, opportunity.status, note)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  saving,
  onChangeStatus,
  onChangeNote,
}: {
  opportunity: Opportunity;
  saving: boolean;
  onChangeStatus: (status: Status) => void;
  onChangeNote: (note: string) => void;
}) {
  const [note, setNote] = useState(opportunity.note);

  return (
    <Card className="p-4">
      <p className="text-sm font-medium leading-snug">{opportunity.query}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="font-normal">
          Position {formatPosition(opportunity.position)}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {formatNumber(opportunity.impressions)} impr.
        </Badge>
        <Badge variant="outline" className="font-normal text-amber-700">
          CTR {formatPercent(opportunity.ctr)}
        </Badge>
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (note !== opportunity.note) onChangeNote(note);
        }}
        placeholder="Note (action prévue, échéance…)"
        rows={2}
        className="mt-3 w-full resize-none rounded-md border border-border bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="mt-3 flex items-center gap-2">
        <select
          value={opportunity.status}
          onChange={(event) => onChangeStatus(event.target.value as Status)}
          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="a_traiter">À traiter</option>
          <option value="en_cours">En cours</option>
          <option value="traite">Traité</option>
          <option value="ignore">Ignorer</option>
        </select>
        {saving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>
    </Card>
  );
}

function formatPosition(value: number) {
  return value > 0 ? value.toFixed(1).replace(".", ",") : "—";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
