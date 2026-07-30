// Chronologie client 360° : histoire complète du client reconstituée à partir
// des données déjà enregistrées (aucune donnée créée, aucun calcul nouveau).
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  ClipboardList,
  Euro,
  HardHat,
  History,
  Lightbulb,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatEuro } from "@/lib/pilot";

export interface TimelineInput {
  createdAt?: string | null;
  interventions: Array<{
    id: string;
    intervention_date: string;
    title: string | null;
    intervention_type: string | null;
    status: string;
    hours_spent: number | null;
  }>;
  ceev: Array<{ id: string; label: string; year: number; pv_ht: number }>;
  sstMissions: Array<{ id: string; mission_date: string; service_requested: string }>;
  caEntries: Array<{ id: string; entry_date: string; amount_ht: number }>;
  recommendations: Array<{ id: string; title: string; status: string; created_at: string }>;
  nextAction?: string | null;
}

interface TimelineEvent {
  key: string;
  date: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  badge?: string;
}

function fmt(date: string) {
  const d = new Date(date);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("fr-FR") : date;
}

export function buildTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (input.createdAt) {
    events.push({
      key: "creation",
      date: input.createdAt,
      icon: UserPlus,
      label: "Client créé dans l'application",
    });
  }

  for (const i of input.interventions) {
    events.push({
      key: `interv:${i.id}`,
      date: i.intervention_date,
      icon: HardHat,
      label: i.title || i.intervention_type || "Intervention",
      detail: i.hours_spent != null ? `${Number(i.hours_spent).toFixed(1)} h réalisées` : undefined,
      badge: i.status,
    });
  }

  for (const c of input.ceev) {
    events.push({
      key: `ceev:${c.id}`,
      date: `${c.year}-01-01`,
      icon: ClipboardList,
      label: `Contrat d'entretien ${c.year} — ${c.label}`,
      detail: `${formatEuro(Number(c.pv_ht) || 0)} de prix de vente`,
    });
  }

  for (const m of input.sstMissions) {
    events.push({
      key: `sst:${m.id}`,
      date: m.mission_date,
      icon: Sparkles,
      label: `Mission sous-traitée — ${m.service_requested}`,
    });
  }

  // Évolution du CA : une ligne par exercice (somme des ventes rattachées).
  const byYear = new Map<number, number>();
  for (const e of input.caEntries) {
    const y = new Date(e.entry_date).getFullYear();
    if (!Number.isFinite(y)) continue;
    byYear.set(y, (byYear.get(y) ?? 0) + (Number(e.amount_ht) || 0));
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  years.forEach((y, idx) => {
    const total = byYear.get(y) ?? 0;
    const prev = idx > 0 ? (byYear.get(years[idx - 1]) ?? 0) : null;
    const evolution =
      prev != null && prev > 0 ? ((total - prev) / prev) * 100 : null;
    events.push({
      key: `ca:${y}`,
      date: `${y}-12-31`,
      icon: Euro,
      label: `Chiffre d'affaires ${y} : ${formatEuro(total)}`,
      detail:
        evolution != null
          ? `${evolution >= 0 ? "+" : ""}${evolution.toFixed(0)} % vs ${y - 1}`
          : undefined,
    });
  });

  for (const r of input.recommendations) {
    events.push({
      key: `reco:${r.id}`,
      date: r.created_at,
      icon: Lightbulb,
      label: `Recommandation — ${r.title}`,
      badge: r.status,
    });
  }

  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function ClientTimeline(props: TimelineInput) {
  const events = buildTimeline(props);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Histoire du client
          <Badge variant="outline" className="ml-auto text-[10px]">
            {events.length} évènement{events.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {props.nextAction && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Prochaine action proposée : </span>
              {props.nextAction}
            </span>
          </div>
        )}
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun évènement enregistré pour ce client.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-5">
            {events.map((e) => (
              <li key={e.key} className="relative">
                <span className="absolute -left-[26px] grid h-5 w-5 place-items-center rounded-full border border-border bg-background">
                  <e.icon className="h-3 w-3 text-primary" />
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{fmt(e.date)}</span>
                  <span className="text-sm font-medium">{e.label}</span>
                  {e.badge && (
                    <Badge variant="outline" className="text-[10px]">
                      {e.badge}
                    </Badge>
                  )}
                </div>
                {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}