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
import { startOfWeek, endOfWeek, isSameDay, inRange } from "@/lib/date-utils";
import {
  Euro, Wallet, Target, CalendarDays, Sparkles, AlertTriangle, FileText,
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
  const wStart = startOfWeek(today);
  const wEnd = endOfWeek(today);

  const planningToday = allI.filter((i) => isSameDay(i.intervention_date, today));
  const planningWeek = allI.filter((i) => inRange(i.intervention_date, wStart, wEnd));

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

  // Clients dormants (dernière intervention > 180 j)
  const DAY = 24 * 60 * 60 * 1000;
  const lastByClient = new Map<string, number>();
  allI.forEach((i) => {
    const t = new Date(i.intervention_date).getTime();
    const prev = lastByClient.get(i.client_id) ?? 0;
    if (t > prev) lastByClient.set(i.client_id, t);
  });
  const dormants = Array.from(lastByClient.entries()).filter(
    ([, t]) => today.getTime() - t > 180 * DAY,
  );

  // Objectifs mensuels en retard : status en_cours & deadline < aujourd'hui
  const goalsLate = allG.filter((g) => {
    if (g.status !== "en_cours" || !g.deadline) return false;
    return new Date(g.deadline).getTime() < today.setHours(0, 0, 0, 0);
  });

  const priority = priorityOffers.data ?? [];

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
    const cut = today.getTime() - 365 * DAY;
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
    const cut = today.getTime() - 365 * DAY;
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

      {/* Performance du jour */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Performance du mois</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="CA du mois" value={formatEuro(k.caMonth)} icon={Euro} to="/pilot/ca" />
          <KpiCard
            label="Objectif du mois"
            value={objectifMois > 0 ? formatEuro(objectifMois) : "—"}
            sub={objectifMois > 0 ? `Réf. ${year - 1}` : "Pas d'historique N-1"}
            icon={Target}
          />
          <KpiCard
            label="Avancement"
            value={objectifMois > 0 ? `${avancement.toFixed(0)} %` : "—"}
            icon={CheckCircle2}
            progress={objectifMois > 0 ? avancement : undefined}
            tone={avancement >= 100 ? "positive" : avancement >= 60 ? "default" : "warning"}
          />
          <KpiCard
            label="Bénéfice estimé (mois)"
            value={formatEuro(beneficeMois)}
            icon={Wallet}
            tone={beneficeMois >= 0 ? "positive" : "negative"}
            sub={`Marge ${k.marge.toFixed(0)} %`}
          />
        </div>
      </section>

      {/* Décisions du jour */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Décisions du jour
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <DecisionCard
            priority="urgent"
            title="Actions urgentes"
            count={decisionCounts.urgent}
            hint="Compte-rendus, heures, retards, dépassements"
          />
          <DecisionCard
            priority="opportunite"
            title="Opportunités commerciales"
            count={decisionCounts.opportunite}
            hint="Recos à convertir & clients à fort potentiel"
          />
          <DecisionCard
            priority="important"
            title="Actions administratives / commerciales"
            count={decisionCounts.important}
            hint="Relances, ventes croisées, dérives de marge"
          />
        </div>
      </section>

      {/* Actions prioritaires */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Actions prioritaires
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <ActionCard
            priority="urgent"
            icon={Handshake}
            title="Recommandations acceptées à planifier"
            count={acceptedNotPlanned.length}
            to="/pilot/direction"
            emptyLabel="Rien à planifier"
          />
          <ActionCard
            priority="urgent"
            icon={FileText}
            title="Interventions terminées sans compte-rendu envoyé"
            count={terminatedNoReport.length}
            to="/interventions"
            emptyLabel="Tous les CR sont envoyés"
          />
          <ActionCard
            priority="urgent"
            icon={Clock}
            title="Interventions sans heures confirmées"
            count={missingHours.length}
            to="/interventions"
            emptyLabel="Toutes les heures sont confirmées"
          />
          <ActionCard
            priority="opportunite"
            icon={Sparkles}
            title="Opportunités prioritaires (score ≥ 80)"
            count={priority.length}
            to="/pilot/clients"
            emptyLabel="Aucune opportunité prioritaire"
          />
        </div>
      </section>

      {/* Planning */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Planning</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Aujourd'hui</h4>
                <Badge variant="secondary" className="ml-auto">{planningToday.length}</Badge>
              </div>
              {planningToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune intervention prévue aujourd'hui.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {planningToday.slice(0, 6).map((i) => (
                    <li key={i.id}>
                      <Link
                        to="/interventions/$interventionId"
                        params={{ interventionId: i.id }}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
                      >
                        <span className="truncate">{i.title ?? i.intervention_type ?? "Intervention"}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Cette semaine</h4>
                <Badge variant="secondary" className="ml-auto">{planningWeek.length}</Badge>
              </div>
              {planningWeek.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune intervention prévue cette semaine.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {planningWeek.slice(0, 6).map((i) => (
                    <li key={i.id}>
                      <Link
                        to="/interventions/$interventionId"
                        params={{ interventionId: i.id }}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
                      >
                        <span className="truncate">
                          {new Date(i.intervention_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
                          {" · "}
                          {i.title ?? i.intervention_type ?? "Intervention"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Alertes */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Alertes rentabilité</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <AlertCard
            priority="urgent"
            icon={TrendingDown}
            title="Dépassements de temps"
            count={timeOverruns.length}
            hint="Temps réel > 150 % de la moyenne du type"
            to="/interventions"
          />
          <AlertCard
            priority="important"
            icon={Gauge}
            title="Rentabilité horaire sous la cible"
            count={lowHourlyEntries.length}
            hint={targetHR > 0 ? `Lignes CA sous ${formatEuro(targetHR)}/h (heures réelles si dispo)` : "Définir un taux horaire cible"}
            to="/pilot/ca"
          />
          <AlertCard
            priority="important"
            icon={Flame}
            title="Clients chronophages peu rentables"
            count={heavyLowMarginClients.length}
            hint="Temps ≥ 20 h/an et taux < 85 % de la cible"
            to="/pilot/clients"
          />
        </div>
        <h3 className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Alertes commerciales</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <AlertCard
            priority="important"
            icon={Users}
            title="Clients sans passage 12 mois"
            count={sleeping12m.length}
            hint="Aucun CA depuis plus d'un an"
            to="/pilot/clients"
          />
          <AlertCard
            priority="opportunite"
            icon={Leaf}
            title="Créations sans contrat entretien"
            count={creationSansEntretien.length}
            hint="Aménagement facturé, aucun entretien associé"
            to="/pilot/clients"
          />
          <AlertCard
            priority="important"
            icon={Lightbulb}
            title="Entretien sans conseil récent"
            count={entretienSansConseil.length}
            hint="Aucune prestation de conseil depuis 12 mois"
            to="/pilot/clients"
          />
          <AlertCard
            priority="opportunite"
            icon={Sparkles}
            title="Potentiel de vente additionnelle"
            count={nboClients.size}
            hint="Clients avec au moins une opportunité à score ≥ 80"
            to="/pilot/clients"
          />
        </div>
        <h3 className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Alertes générales</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <AlertCard
            priority="important"
            icon={Users}
            title="Clients dormants (6 mois)"
            count={dormants.length}
            hint="Sans intervention depuis + de 6 mois"
            to="/pilot/clients"
          />
          <AlertCard
            priority="urgent"
            icon={Send}
            title="Comptes-rendus non envoyés"
            count={terminatedNoReport.length}
            hint="Intervention terminée sans envoi client"
            to="/interventions"
          />
          <AlertCard
            priority="urgent"
            icon={Flag}
            title="Objectifs en retard"
            count={goalsLate.length}
            hint="Échéance dépassée, statut en cours"
            to="/pilot/objectifs"
          />
        </div>
      </section>
    </div>
  );
}

function ActionCard({
  icon: Icon, title, count, to, emptyLabel, priority,
}: {
  icon: typeof Handshake; title: string; count: number; to: string; emptyLabel: string;
  priority: Priority;
}) {
  const empty = count === 0;
  const meta = PRIORITY_META[priority];
  return (
    <Link to={to}>
      <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
            <Icon className="h-4 w-4 text-primary/80" />
            <p className="text-sm font-medium">{title}</p>
          </div>
          <Badge variant={empty ? "outline" : "default"} className="shrink-0">
            {count}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {empty ? emptyLabel : "Cliquer pour ouvrir la liste"}
        </p>
      </Card>
    </Link>
  );
}

function AlertCard({
  icon: Icon, title, count, hint, to, priority,
}: {
  icon: typeof AlertTriangle; title: string; count: number; hint: string; to: string;
  priority: Priority;
}) {
  const active = count > 0;
  const meta = PRIORITY_META[priority];
  return (
    <Link to={to}>
      <Card
        className={`h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
          active ? meta.ring : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
            <Icon className={`h-4 w-4 ${active ? "text-foreground" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">{title}</p>
          </div>
          <span className={`font-serif text-lg font-semibold ${active ? "" : "text-muted-foreground"}`}>
            {count}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </Card>
    </Link>
  );
}

function DecisionCard({
  priority, title, count, hint,
}: {
  priority: Priority; title: string; count: number; hint: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <Card className={`h-full p-4 ${count > 0 ? meta.ring : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${meta.badge}`}>{meta.label}</Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-serif text-3xl font-semibold tracking-tight">{count}</span>
        <p className="pb-1 text-right text-xs text-muted-foreground">{hint}</p>
      </div>
    </Card>
  );
}