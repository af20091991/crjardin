import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardList, ChevronRight, Search, X } from "lucide-react";
import { listWorksiteSheets, INTERVENANTS } from "@/lib/worksite";
import { useRole } from "@/hooks/use-role";

type Period = "all" | "upcoming" | "30d" | "year" | "undated";
type SortKey = "date_desc" | "date_asc" | "client";
const PAGE = 25;

export const Route = createFileRoute("/_authenticated/fiches/")({
  head: () => ({ meta: [{ title: "Fiches SST — De la graine au jardin" }] }),
  component: FichesIndex,
});

function monthKey(d: string | null) {
  if (!d) return "sans-date";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  if (key === "sans-date") return "Sans date";
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function FichesIndex() {
  const navigate = useNavigate();
  const { canEdit, isLoading: roleLoading } = useRole();
  useEffect(() => {
    if (!roleLoading && !canEdit) navigate({ to: "/", replace: true });
  }, [canEdit, roleLoading, navigate]);

  const { data: sheets, isLoading } = useQuery({
    queryKey: ["worksite-sheets"],
    queryFn: listWorksiteSheets,
    enabled: canEdit,
  });

  const [search, setSearch] = useState("");
  const [intervenant, setIntervenant] = useState("all");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [limit, setLimit] = useState(PAGE);
  const q = search.trim().toLowerCase();

  const name = (s: NonNullable<typeof sheets>[number]) =>
    [s.civility?.trim(), s.client_name?.trim()].filter(Boolean).join(" ") || "Sans nom";

  const filtered = useMemo(() => {
    const now = new Date();
    let list = [...(sheets ?? [])];
    if (intervenant !== "all") list = list.filter((s) => s.intervenant === intervenant);
    if (period !== "all") {
      list = list.filter((s) => {
        if (!s.intervention_date) return period === "undated";
        const d = new Date(s.intervention_date);
        if (period === "undated") return false;
        if (period === "upcoming") return d.getTime() >= now.setHours(0, 0, 0, 0);
        if (period === "30d") return Date.now() - d.getTime() <= 30 * 864e5;
        return d.getFullYear() === new Date().getFullYear();
      });
    }
    if (q) {
      list = list.filter((s) =>
        [name(s), s.address, s.intervenant, s.contact_person, ...s.tasks].some((f) =>
          f?.toLowerCase().includes(q),
        ),
      );
    }
    list.sort((a, b) => {
      if (sort === "client") return name(a).localeCompare(name(b), "fr");
      const da = a.intervention_date ? new Date(a.intervention_date).getTime() : 0;
      const db = b.intervention_date ? new Date(b.intervention_date).getTime() : 0;
      return sort === "date_asc" ? da - db : db - da;
    });
    return list;
  }, [sheets, q, intervenant, period, sort]);

  const visible = filtered.slice(0, limit);

  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const s of visible) {
      const key = sort === "client" ? name(s) : monthKey(s.intervention_date);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [visible, sort]);

  const hasFilters = q !== "" || intervenant !== "all" || period !== "all";

  return (
    <AppShell title="Fiches SST">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Rechercher un client, une adresse, une tâche…"
                className="pl-9"
              />
            </div>
            <Link to="/fiches/new" className="shrink-0">
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Nouvelle fiche
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={intervenant}
              onValueChange={(v) => {
                setIntervenant(v);
                setLimit(PAGE);
              }}
            >
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les intervenants</SelectItem>
                {INTERVENANTS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={period}
              onValueChange={(v) => {
                setPeriod(v as Period);
                setLimit(PAGE);
              }}
            >
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes périodes</SelectItem>
                <SelectItem value="upcoming">À venir</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="year">Année en cours</SelectItem>
                <SelectItem value="undated">Sans date</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Plus récentes d'abord</SelectItem>
                <SelectItem value="date_asc">Plus anciennes d'abord</SelectItem>
                <SelectItem value="client">Par client (A→Z)</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  setSearch("");
                  setIntervenant("all");
                  setPeriod("all");
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Réinitialiser
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} fiche{filtered.length > 1 ? "s" : ""}
          {visible.length < filtered.length ? ` · ${visible.length} affichée(s)` : ""}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Aucune fiche ne correspond.</p>
              <Link to="/fiches/new">
                <Button><Plus className="mr-1.5 h-4 w-4" /> Créer une fiche</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map(([key, rows]) => (
              <section key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {sort === "client" ? key : monthLabel(key)}
                  </h2>
                  <span className="text-[11px] text-muted-foreground">{rows.length}</span>
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {rows.map((s) => (
                    <Link
                      key={s.id}
                      to="/fiches/$ficheId"
                      params={{ ficheId: s.id }}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {s.intervention_date
                          ? new Date(s.intervention_date).toLocaleDateString("fr-FR")
                          : "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name(s)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.address ?? "Adresse non renseignée"}
                          {s.tasks.length ? ` · ${s.tasks.length} tâche(s)` : ""}
                        </p>
                      </div>
                      {s.intervenant && (
                        <Badge variant="secondary" className="shrink-0">{s.intervenant}</Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {visible.length < filtered.length && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                  Afficher {Math.min(PAGE, filtered.length - visible.length)} de plus
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
