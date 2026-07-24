import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { KpiCard } from "@/components/pilot/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { computeKpis, clientStatsWithHours, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { listAllInterventions } from "@/lib/interventions";
import { listAllRecommendations } from "@/lib/garden";
import { listGoals } from "@/lib/pilot-goals";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_ACTIVITY_RULES } from "@/lib/client-activity";
import type { FocusTopic } from "@/lib/pilot-focus";
import { CoverageBanner } from "@/components/pilot/CoverageBanner";
import {
  Euro, Wallet, Sparkles, AlertTriangle,
  Clock, Handshake, Users, CheckCircle2, ArrowRight, Send,
  TrendingDown, Gauge, Flame, Leaf, Lightbulb, Flag,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/")({
  head: () => ({ meta: [{ title: "Aujourd'hui — Pilot Pro" }] }),
  component: TodayPage,
});

type NBOffer = {
  client_id: string;
  service_id: string;
  service_name: string;
  score_opportunity: number;
};

type Priority = "urgent" | "important" | "opportunite";
const PRIORITY_META: Record<
  Priority,
  { dot: string; label: string; badge: string; ring: string }
> = {
  urgent: {
    dot: "bg-red-500",
    label: "Urgent",
    badge: "bg-red-50 text-red-700 border-red-200",
    ring: "border-red-200 bg-red-50/50",
  },
  important: {
    dot: "bg-orange-500",
    label: "Important",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    ring: "border-orange-200 bg-orange-50/50",
  },
  opportunite: {
    dot: "bg-emerald-500",
    label: "Opportunité",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "border-emerald-200 bg-emerald-50/50",
  },
};

function TodayPage() {
  const { entries, charges, settings } = usePilotData();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const interventions = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });
  const recos = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const goals = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const priorityOffers = useQuery({
    queryKey: ["nbo-priority"],
    queryFn: async (): Promise<NBOffer[]> => {
      const { data, error } = await supabase
        .from("v_client_next_best_offers" as never)
        .select("client_id, service_id, service_name, score_opportunity")
        .gte("score_opportunity", 80)
        .order("score_opportunity", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as NBOffer[];
    },
  });

  const loading =
    entries.isLoading || charges.isLoading || settings.isLoading ||
    interventions.isLoading || recos.isLoading || goals.isLoading;

  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  // Heures confirmées (interventions.hours_spent, statut = termine) sur l'année en cours.
  // Calculé avant `computeKpis` pour alimenter `tauxHoraireReel`.
  const confirmedHoursByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of interventions.data ?? []) {
      if (i.status !== "termine" || i.hours_spent == null) continue;
      const d = new Date(i.intervention_date);
      if (d.getFullYear() !== year) continue;
      const h = Number(i.hours_spent);
      if (!Number.isFinite(h) || h <= 0) continue;
      map.set(i.client_id, (map.get(i.client_id) ?? 0) + h);
    }
    return map;
  }, [interventions.data, year]);

  const k = useMemo(
    () =>
      computeKpis({
        entries: entries.data ?? [],
        charges: charges.data ?? [],
        settings: set,
        year,
        month,
        confirmedHoursByClient,
      }),
    [entries.data, charges.data, set, year, month, confirmedHoursByClient],
  );

  // Objectif du mois = CA du même mois N-1 (référentiel factuel, aucune nouvelle donnée)
  const objectifMois = useMemo(() => {
    const rows = (entries.data ?? []).filter((e) => {
      const d = new Date(e.entry_date);
      return d.getFullYear() === year - 1 && d.getMonth() === month;
    });
    return rows.reduce((s, e) => s + e.amount_ht, 0);
  }, [entries.data, year, month]);
  const avancement = objectifMois > 0 ? (k.caMonth / objectifMois) * 100 : 0;

  const beneficeMois = useMemo(() => {
    // approximation : marge annuelle appliquée au CA du mois
    const marge = k.marge / 100;
    return k.caMonth * marge;
  }, [k]);

  const allI = interventions.data ?? [];
  const allR = recos.data ?? [];
  const allG = goals.data ?? [];

  const today = new Date();

  const acceptedNotPlanned = allR.filter(
    (r) => r.status === "acceptee" && !r.planned_intervention_id,
  );
  const terminatedNoReport = allI.filter(
    (i) => i.status === "termine" && !i.sent_to_client_at,
  );
  const missingHours = allI.filter((i) => {
    if (i.status !== "termine") return false;
    const estimated =
      i.ai_metadata && typeof i.ai_metadata === "object" &&
      (i.ai_metadata as Record<string, unknown>).hours_estimated === true;
    return i.hours_spent == null || estimated;
  });

  // Clients dormants — seuils centralisés (CLIENT_ACTIVITY_RULES)
  const DAY = 24 * 60 * 60 * 1000;
  const lastByClient = new Map<string, number>();
  allI.forEach((i) => {
    const t = new Date(i.intervention_date).getTime();
    const prev = lastByClient.get(i.client_id) ?? 0;
    if (t > prev) lastByClient.set(i.client_id, t);
  });
  const dormants = Array.from(lastByClient.entries()).filter(
    ([, t]) => today.getTime() - t > CLIENT_ACTIVITY_RULES.WARNING_DAYS * DAY,
  );

  // Objectifs mensuels en retard : status en_cours & deadline < aujourd'hui
  const goalsLate = allG.filter((g) => {
    if (g.status !== "en_cours" || !g.deadline) return false;
    return new Date(g.deadline).getTime() < today.setHours(0, 0, 0, 0);
  });

  const priority = priorityOffers.data ?? [];

  // Nom client par ID (pour opportunités et priorités affichées)
  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries.data ?? []) {
      if (e.client_id && e.client_name) map.set(e.client_id, e.client_name);
    }
    return map;
  }, [entries.data]);

  // ------- Nouvelles analyses (aucune nouvelle donnée) -------
  const targetHR = set.target_hourly_rate || 0;

  // Moyenne d'heures par type d'intervention (issue des interventions terminées avec heures confirmées)
  const avgHoursByType = useMemo(() => {
    const acc = new Map<string, { total: number; n: number }>();
    for (const i of allI) {
      if (i.status !== "termine" || i.hours_spent == null) continue;
      const estimated =
        i.ai_metadata && typeof i.ai_metadata === "object" &&
        (i.ai_metadata as Record<string, unknown>).hours_estimated === true;
      if (estimated) continue;
      const key = i.intervention_type ?? "—";
      const cur = acc.get(key) ?? { total: 0, n: 0 };
      cur.total += Number(i.hours_spent);
      cur.n += 1;
      acc.set(key, cur);
    }
    const out = new Map<string, number>();
    acc.forEach((v, k) => v.n >= 2 && out.set(k, v.total / v.n));
    return out;
  }, [allI]);

  // Interventions dont le temps réel dépasse fortement (>50 %) la moyenne du type
  const timeOverruns = useMemo(
    () =>
      allI.filter((i) => {
        if (i.status !== "termine" || i.hours_spent == null) return false;
        const key = i.intervention_type ?? "—";
        const avg = avgHoursByType.get(key);
        if (!avg || avg <= 0) return false;
        return Number(i.hours_spent) > avg * 1.5;
      }),
    [allI, avgHoursByType],
  );

  // CA agrégé par client sur l'année (pour taux horaire réel par client)
  const caByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries.data ?? []) {
      if (!e.client_id) continue;
      if (new Date(e.entry_date).getFullYear() !== year) continue;
      map.set(e.client_id, (map.get(e.client_id) ?? 0) + e.amount_ht);
    }
    return map;
  }, [entries.data, year]);

  // Lignes CA dont la rentabilité horaire est sous la cible.
  // Priorité : taux horaire réel du client (CA client / heures confirmées) quand disponible ;
  // à défaut, ratio de la ligne (amount_ht / hours vendues).
  const lowHourlyEntries = useMemo(() => {
    if (targetHR <= 0) return [];
    return (entries.data ?? []).filter((e) => {
      const realHours = e.client_id ? confirmedHoursByClient.get(e.client_id) ?? 0 : 0;
      if (realHours > 0 && e.client_id) {
        const clientCa = caByClient.get(e.client_id) ?? 0;
        if (clientCa <= 0) return false;
        return clientCa / realHours < targetHR;
      }
      return e.hours > 0 && e.amount_ht / e.hours < targetHR;
    });
  }, [entries.data, targetHR, confirmedHoursByClient, caByClient]);

  // Clients A/B avec ratio horaire dégradé (basé sur heures réellement passées)
  const cstats = useMemo(
    () => clientStatsWithHours(entries.data ?? [], year, confirmedHoursByClient),
    [entries.data, year, confirmedHoursByClient],
  );
  const heavyLowMarginClients = useMemo(() => {
    if (targetHR <= 0) return cstats.filter(() => false);
    return cstats.filter(
      (c) => c.hours >= 20 && c.hourlyRate > 0 && c.hourlyRate < targetHR * 0.85,
    );
  }, [cstats, targetHR]);

  // Commercial : dernier passage par client (via CA entries pour couvrir aussi les ventes sans intervention)
  const lastByClientCa = useMemo(() => {
    const map = new Map<string, { name: string; last: number; families: Set<string>; lastByFamily: Map<string, number> }>();
    for (const e of entries.data ?? []) {
      const key = e.client_id ?? `name:${(e.client_name ?? "").toLowerCase()}`;
      if (!key) continue;
      const t = new Date(e.entry_date).getTime();
      const cur =
        map.get(key) ?? {
          name: e.client_name ?? "Sans nom",
          last: 0,
          families: new Set<string>(),
          lastByFamily: new Map<string, number>(),
        };
      if (t > cur.last) cur.last = t;
      cur.families.add(e.family);
      const prevF = cur.lastByFamily.get(e.family) ?? 0;
      if (t > prevF) cur.lastByFamily.set(e.family, t);
      if (e.client_name) cur.name = e.client_name;
      map.set(key, cur);
    }
    return map;
  }, [entries.data]);

  const sleeping12m = useMemo(() => {
    const cut = today.getTime() - CLIENT_ACTIVITY_RULES.DORMANT_DAYS * DAY;
    return Array.from(lastByClientCa.entries()).filter(([, v]) => v.last < cut);
  }, [lastByClientCa]);

  const creationSansEntretien = useMemo(
    () =>
      Array.from(lastByClientCa.entries()).filter(
        ([, v]) => v.families.has("amenagement") && !v.families.has("sap"),
      ),
    [lastByClientCa],
  );

  const entretienSansConseil = useMemo(() => {
    const cut = today.getTime() - CLIENT_ACTIVITY_RULES.DORMANT_DAYS * DAY;
    return Array.from(lastByClientCa.entries()).filter(([, v]) => {
      if (!v.families.has("sap")) return false;
      const lastConseil = v.lastByFamily.get("conseil") ?? 0;
      return lastConseil < cut;
    });
  }, [lastByClientCa]);

  const nboClients = useMemo(() => {
    const s = new Set<string>();
    priority.forEach((o) => s.add(o.client_id));
    return s;
  }, [priority]);

  // Décisions du jour — synthèse
  const decisionCounts = {
    urgent:
      acceptedNotPlanned.length +
      terminatedNoReport.length +
      missingHours.length +
      goalsLate.length +
      timeOverruns.length,
    important:
      dormants.length +
      heavyLowMarginClients.length +
      entretienSansConseil.length +
      creationSansEntretien.length +
      (lowHourlyEntries.length > 0 ? 1 : 0),
    opportunite: nboClients.size + acceptedNotPlanned.length,
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  // Delta CA mois vs N-1 (question "où en suis-je ?")
  const deltaMoisPct = objectifMois > 0 ? ((k.caMonth - objectifMois) / objectifMois) * 100 : 0;
  const tauxReel = k.tauxHoraireReel ?? 0;
  const tauxEcartPct = targetHR > 0 && tauxReel > 0 ? ((tauxReel - targetHR) / targetHR) * 100 : 0;

  // Priorités du jour — classées par volume, ne montre que les non-vides.
  const priorities: Array<{
    key: string; label: string; count: number; icon: typeof Handshake;
    topic?: FocusTopic; to?: string; tone: Priority;
  }> = [
    { key: "cr", label: "Comptes-rendus à envoyer", count: terminatedNoReport.length, icon: Send, topic: "cr-non-envoyes" as FocusTopic, tone: "urgent" as Priority },
    { key: "h", label: "Heures à confirmer", count: missingHours.length, icon: Clock, topic: "heures-manquantes" as FocusTopic, tone: "urgent" as Priority },
    { key: "r", label: "Recommandations à planifier", count: acceptedNotPlanned.length, icon: Handshake, topic: "recos-a-planifier" as FocusTopic, tone: "urgent" as Priority },
    { key: "d", label: "Dépassements de temps", count: timeOverruns.length, icon: TrendingDown, topic: "depassements-temps" as FocusTopic, tone: "urgent" as Priority },
    { key: "g", label: "Objectifs en retard", count: goalsLate.length, icon: Flag, to: "/pilot/objectifs", tone: "urgent" as Priority },
  ].filter((p) => p.count > 0).sort((a, b) => b.count - a.count);

  // Risques — condensés, seuls les non-vides.
  const risks: Array<{
    key: string; label: string; count: number; hint: string;
    icon: typeof AlertTriangle; topic: FocusTopic;
  }> = [
    {
      key: "low",
      label: "Rentabilité horaire sous cible",
      count: lowHourlyEntries.length,
      hint: targetHR > 0 ? `Sous ${formatEuro(targetHR)}/h` : "Définir un taux cible",
      icon: Gauge,
      topic: "rentabilite-faible" as FocusTopic,
    },
    {
      key: "chr",
      label: "Clients chronophages",
      count: heavyLowMarginClients.length,
      hint: "≥ 20 h/an et taux < 85 % de la cible",
      icon: Flame,
      topic: "chronophages" as FocusTopic,
    },
    {
      key: "sl",
      label: "Clients dormants (> 12 mois)",
      count: sleeping12m.length,
      hint: "Aucun CA depuis plus d'un an",
      icon: Users,
      topic: "dormants" as FocusTopic,
    },
  ].filter((r) => r.count > 0);

  // Opportunités — Top 3 NBO déjà scorées ≥ 80.
  const topOffers = priority.slice(0, 3);

  // Signaux commerciaux annexes (chips)
  const secondarySignals: Array<{
    label: string; count: number; topic: FocusTopic;
  }> = [
    { label: "Créations sans entretien", count: creationSansEntretien.length, topic: "creation-sans-entretien" as FocusTopic },
    { label: "Entretien sans conseil récent", count: entretienSansConseil.length, topic: "entretien-sans-conseil" as FocusTopic },
    { label: "Clients dormants (6 mois)", count: dormants.length, topic: "dormants" as FocusTopic },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Bonjour, voici votre journée
        </h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <CoverageBanner year={year} />

      {/* 1 — Où en est mon entreprise aujourd'hui ? */}
      <section className="space-y-2">
      <SectionTitle question="Où en est mon entreprise ?" label="Synthèse dirigeant" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="CA du mois"
            value={formatEuro(k.caMonth)}
            icon={Euro}
            to="/pilot/ca"
            sub={
              objectifMois > 0
                ? `${deltaMoisPct >= 0 ? "+" : ""}${deltaMoisPct.toFixed(0)} % vs ${year - 1}`
                : undefined
            }
            tone={objectifMois > 0 ? (deltaMoisPct >= 0 ? "positive" : "warning") : "default"}
          />
          <KpiCard
            label="Avancement mois"
            value={objectifMois > 0 ? `${avancement.toFixed(0)} %` : "—"}
            icon={CheckCircle2}
            progress={objectifMois > 0 ? avancement : undefined}
            tone={avancement >= 100 ? "positive" : avancement >= 60 ? "default" : "warning"}
            sub={objectifMois > 0 ? `Objectif ${formatEuro(objectifMois)}` : "Pas d'historique N-1"}
          />
          <KpiCard
            label="Marge estimée"
            value={`${k.marge.toFixed(0)} %`}
            icon={Wallet}
            tone={k.marge >= 20 ? "positive" : k.marge >= 10 ? "default" : "warning"}
            sub={`Bénéfice mois ${formatEuro(beneficeMois)}`}
          />
          <KpiCard
            label="Taux horaire réel"
            value={tauxReel > 0 ? `${formatEuro(tauxReel)}/h` : "—"}
            icon={Gauge}
            to="/pilot/taux"
            tone={targetHR > 0 && tauxReel > 0 ? (tauxReel >= targetHR ? "positive" : "warning") : "default"}
            sub={
              targetHR > 0 && tauxReel > 0
                ? `${tauxEcartPct >= 0 ? "+" : ""}${tauxEcartPct.toFixed(0)} % vs cible ${formatEuro(targetHR)}`
                : targetHR > 0
                  ? `Cible ${formatEuro(targetHR)}/h`
                  : undefined
            }
          />
        </div>
      </section>

      {/* 2 — Quelles sont mes priorités ? */}
      <section className="space-y-2">
      <SectionTitle question="Quelles sont mes priorités ?" label="Priorités du jour" />
        {priorities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">Aucune action urgente. Concentrez-vous sur les opportunités.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {priorities.map((p, idx) => (
              <PriorityRow
                key={p.key}
                rank={idx + 1}
                icon={p.icon}
                label={p.label}
                count={p.count}
                topic={p.topic}
                to={p.to}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3 — Quels risques dois-je traiter ? */}
      <section className="space-y-2">
      <SectionTitle question="Quelles alertes dois-je traiter ?" label="Alertes" />
        {risks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">Aucun risque détecté avec les seuils actuels.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {risks.map((r) => (
              <RiskCard key={r.key} icon={r.icon} title={r.label} count={r.count} hint={r.hint} topic={r.topic} />
            ))}
          </div>
        )}
      </section>

      {/* 4 — Quelles opportunités puis-je saisir ? */}
      <section className="space-y-2">
      <SectionTitle question="Quelles opportunités puis-je saisir ?" label="Opportunités commerciales" />
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <h4 className="font-medium">Top offres à proposer</h4>
                <Badge variant="secondary" className="ml-auto">{priority.length}</Badge>
              </div>
              {topOffers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune opportunité à score ≥ 80.</p>
              ) : (
                <ul className="divide-y">
                  {topOffers.map((o) => (
                    <li key={`${o.client_id}-${o.service_id}`}>
                      <Link
                        to="/pilot/fiche/$clientId"
                        params={{ clientId: o.client_id }}
                        className="flex items-center gap-3 py-2 hover:bg-accent/40 rounded-md px-2 -mx-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {clientNameById.get(o.client_id) ?? "Client"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{o.service_name}</p>
                        </div>
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Score {Math.round(o.score_opportunity)}
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {priority.length > 3 && (
                <Link
                  to="/pilot/focus/$topic"
                  params={{ topic: "opportunites" }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Voir les {priority.length} opportunités <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Signaux à activer</h4>
              </div>
              {secondarySignals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun signal secondaire actif.</p>
              ) : (
                <ul className="space-y-1.5">
                  {secondarySignals.map((s) => (
                    <li key={s.topic}>
                      <Link
                        to="/pilot/focus/$topic"
                        params={{ topic: s.topic }}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/40"
                      >
                        <span className="truncate">{s.label}</span>
                        <Badge variant="outline" className="shrink-0">{s.count}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ question, label }: { question: string; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-serif text-lg font-semibold tracking-tight">{question}</h3>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function PriorityRow({
  rank, icon: Icon, label, count, topic, to,
}: {
  rank: number; icon: typeof Handshake; label: string; count: number;
  topic?: FocusTopic; to?: string;
}) {
  const inner = (
    <Card className="flex items-center gap-3 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-sm font-semibold text-primary">
        {rank}
      </span>
      <Icon className="h-4 w-4 shrink-0 text-primary/80" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{label}</p>
      <Badge className="shrink-0">{count}</Badge>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Card>
  );
  if (topic) {
    return <Link to="/pilot/focus/$topic" params={{ topic }}>{inner}</Link>;
  }
  return <Link to={to ?? "/pilot"}>{inner}</Link>;
}

function RiskCard({
  icon: Icon, title, count, hint, topic,
}: {
  icon: typeof AlertTriangle; title: string; count: number; hint: string; topic: FocusTopic;
}) {
  return (
    <Link to="/pilot/focus/$topic" params={{ topic }}>
      <Card className="h-full border-orange-200 bg-orange-50/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-orange-700" />
            <p className="text-sm font-medium">{title}</p>
          </div>
          <span className="font-serif text-xl font-semibold text-orange-800">{count}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </Card>
    </Link>
  );
}