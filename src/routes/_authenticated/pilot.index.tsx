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
import { CLIENT_ACTIVITY_RULES, fetchClientActivityRows } from "@/lib/client-activity";
import { realHourlyRateFromResolution, marginPct, periodComparison } from "@/lib/pilot-reliability";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { resolveRealHours, interventionsNeedingHours } from "@/lib/pilot-real-hours";
import type { FocusTopic } from "@/lib/pilot-focus";
import { CaStatusCard } from "@/components/pilot/CaStatusCard";
import { countOrphanEntries } from "@/lib/pilot-ca-matching";
import { listHistoricHours } from "@/lib/pilot-historic-hours";
import { HoursSummaryCards } from "@/components/pilot/HoursSummaryCards";
import { listChargeRows } from "@/lib/pilot-charges";
import { projectYear } from "@/lib/pilot-projection";
import { usePilotMode } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { classifyClients } from "@/lib/pilot-client-profitability";
import { analyzeServices } from "@/lib/pilot-service-profitability";
import {
  Euro,
  Wallet,
  Sparkles,
  AlertTriangle,
  Clock,
  Handshake,
  Users,
  CheckCircle2,
  ArrowRight,
  Send,
  TrendingDown,
  Gauge,
  Flame,
  Leaf,
  Flag,
  Link2,
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
const PRIORITY_META: Record<Priority, { dot: string; label: string; badge: string; ring: string }> =
  {
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
  const { entries, charges, settings, clients } = usePilotData();
  const { mode } = usePilotMode();
  const thresholds = useThresholds();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const interventions = useQuery({
    queryKey: ["interventions-all"],
    queryFn: listAllInterventions,
  });
  const recos = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const goals = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const orphanCount = useQuery({
    queryKey: ["pilot-ca-orphan-count"],
    queryFn: countOrphanEntries,
  });
  const historicHours = useQuery({
    queryKey: ["pilot-historic-hours"],
    queryFn: listHistoricHours,
  });
  const chargeRows = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  // Ledger consolidé des heures de l'année : source unique pour le temps réel.
  const hoursLedger = useQuery({
    queryKey: ["pilot-hours-ledger", year],
    queryFn: () => fetchHoursLedger(year),
  });
  const clientActivity = useQuery({
    queryKey: ["client-activity-rows"],
    queryFn: fetchClientActivityRows,
  });
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
    entries.isLoading ||
    charges.isLoading ||
    settings.isLoading ||
    interventions.isLoading ||
    recos.isLoading ||
    goals.isLoading ||
    clientActivity.isLoading ||
    hoursLedger.isLoading;

  // Politique compte-rendu par client : seul un client « Oui » génère une action CR.
  const reportPolicyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients.data ?? []) map.set(c.id, c.report_policy ?? "a_confirmer");
    return map;
  }, [clients.data]);
  const crPolicy = (clientId: string | null | undefined) =>
    (clientId ? reportPolicyById.get(clientId) : undefined) ?? "a_confirmer";

  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  // Heures confirmées (interventions.hours_spent, statut = termine) sur l'année en cours.
  // Calculé avant `computeKpis` pour alimenter `tauxHoraireReel`.
  const confirmedHoursByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of interventions.data ?? []) {
      if (i.status !== "terminee" || i.hours_spent == null) continue;
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
  // Distinction explicite du cycle de vie du compte-rendu :
  // terminée → CR généré → CR envoyé. Une intervention terminée sans CR généré
  // n'est PAS un « CR à envoyer ».
  // Un client marqué « Non » n'apparaît jamais dans les actions CR ; un client
  // « À confirmer » est listé séparément comme élément à qualifier (jamais un retard).
  const reportsToGenerate = allI.filter(
    (i) =>
      i.status === "terminee" &&
      !i.report_generated_at &&
      !i.sent_to_client_at &&
      !i.report_waived_at &&
      crPolicy(i.client_id) === "oui",
  );
  const reportsToSend = allI.filter(
    (i) =>
      i.status === "terminee" &&
      !!i.report_generated_at &&
      !i.sent_to_client_at &&
      !i.report_waived_at &&
      crPolicy(i.client_id) === "oui",
  );
  const crToQualify = useMemo(() => {
    const ids = new Set<string>();
    for (const i of allI) {
      if (i.status !== "terminee" || i.sent_to_client_at || i.report_waived_at) continue;
      if (crPolicy(i.client_id) !== "a_confirmer") continue;
      if (i.client_id) ids.add(i.client_id);
    }
    return ids;
  }, [allI, reportPolicyById]);
  // Heures réelles disponibles dans PP (interventions > historique > ledger CA).
  const hoursResolution = useMemo(
    () => (hoursLedger.data ? resolveRealHours(hoursLedger.data, year) : undefined),
    [hoursLedger.data, year],
  );
  // Une intervention n'est « à renseigner » que si AUCUNE heure n'existe dans PP
  // pour ce client sur l'année : un défaut de liaison n'est jamais une tâche.
  const missingHours = useMemo(
    () => (hoursLedger.data ? interventionsNeedingHours(allI, hoursLedger.data, year) : []),
    [allI, hoursLedger.data, year],
  );

  // Clients dormants / à relancer — clients UNIQUES du référentiel `clients`.
  // Jamais de comptage de lignes CA ou d'historique non rattaché.
  const activityRows = clientActivity.data ?? [];
  const clientsARelancer = activityRows.filter((c) => c.status === "a_relancer");
  const clientsDormants = activityRows.filter((c) => c.status === "dormant");

  // Objectifs mensuels en retard : status en_cours & deadline < aujourd'hui
  const goalsLate = allG.filter((g) => {
    if (g.status !== "en_cours" || !g.deadline) return false;
    return new Date(g.deadline).getTime() < today.setHours(0, 0, 0, 0);
  });

  const priority = priorityOffers.data ?? [];

  // ---- Mode Réel / Projection : une seule source, deux lectures séparées ----
  const projection = useMemo(
    () => projectYear({ entries: entries.data ?? [], charges: chargeRows.data ?? [], year }),
    [entries.data, chargeRows.data, year],
  );
  const isProjection = mode === "projection";
  const caLecture = isProjection ? projection.caProjete : projection.caReel;
  const chargesLecture = isProjection ? projection.chargesProjetees : projection.chargesReelles;
  const resultatLecture = caLecture - chargesLecture;
  const margeLecture = caLecture > 0 ? (resultatLecture / caLecture) * 100 : null;

  // Objectif annuel factuel : CA de l'exercice précédent (aucune saisie requise).
  const objectifAnnuel = useMemo(
    () =>
      (entries.data ?? [])
        .filter((e) => new Date(e.entry_date).getFullYear() === year - 1)
        .reduce((s, e) => s + (Number(e.amount_ht) || 0), 0),
    [entries.data, year],
  );
  const progressionAnnuelle = objectifAnnuel > 0 ? (caLecture / objectifAnnuel) * 100 : null;

  // Classement rentabilité (clients / prestations) — sert aux points d'attention.
  const clientsProfit = useMemo(
    () =>
      hoursLedger.data
        ? classifyClients({
            entries: entries.data ?? [],
            ledger: hoursLedger.data,
            year,
            targetHourlyRate: set.target_hourly_rate || 0,
            thresholds,
          })
        : [],
    [entries.data, hoursLedger.data, year, set.target_hourly_rate, thresholds],
  );
  const services = useMemo(
    () =>
      hoursLedger.data
        ? analyzeServices({
            entries: entries.data ?? [],
            ledger: hoursLedger.data,
            year,
            targetHourlyRate: set.target_hourly_rate || 0,
            thresholds,
          })
        : [],
    [entries.data, hoursLedger.data, year, set.target_hourly_rate, thresholds],
  );

  // Dérive des charges : charges à date vs même part d'exercice en N-1.
  const chargesPrevYearProrata = useMemo(() => {
    const prev = (chargeRows.data ?? []).filter((r) => r.year === year - 1);
    const total = prev.reduce((s, r) => s + r.amount_ht, 0);
    return total > 0 ? (total * projection.monthsObserved) / 12 : 0;
  }, [chargeRows.data, year, projection.monthsObserved]);

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
      if (i.status !== "terminee" || i.hours_spent == null) continue;
      const estimated =
        i.ai_metadata &&
        typeof i.ai_metadata === "object" &&
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
        if (i.status !== "terminee" || i.hours_spent == null) return false;
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
      const realHours = e.client_id ? (confirmedHoursByClient.get(e.client_id) ?? 0) : 0;
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

  // Commercial : dernier passage par client — uniquement les lignes CA rattachées
  // à une fiche du référentiel (jamais de "client fantôme" issu d'une désignation).
  const lastByClientCa = useMemo(() => {
    const map = new Map<
      string,
      { name: string; last: number; families: Set<string>; lastByFamily: Map<string, number> }
    >();
    for (const e of entries.data ?? []) {
      if (!e.client_id) continue;
      const key = e.client_id;
      const t = new Date(e.entry_date).getTime();
      const cur = map.get(key) ?? {
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

  const creationSansEntretien = useMemo(
    () =>
      Array.from(lastByClientCa.entries()).filter(
        ([, v]) => v.families.has("amenagement") && !v.families.has("sap"),
      ),
    [lastByClientCa],
  );

  const entretienSansConseil = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
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
      reportsToSend.length +
      reportsToGenerate.length +
      missingHours.length +
      goalsLate.length +
      timeOverruns.length,
    important:
      clientsARelancer.length +
      clientsDormants.length +
      heavyLowMarginClients.length +
      entretienSansConseil.length +
      creationSansEntretien.length +
      (lowHourlyEntries.length > 0 ? 1 : 0),
    opportunite: nboClients.size + acceptedNotPlanned.length,
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  // ---- Fiabilité des indicateurs stratégiques ----
  // Comparaison CA mois vs même mois N-1 : uniquement si les deux périodes existent.
  const caComparison = periodComparison({ current: k.caMonth, previous: objectifMois });
  // Marge : non calculable sans CA sur l'année.
  const margin = marginPct({ ca: k.caMonth, marge: k.marge });
  // Taux horaire réel : exploite les heures déjà présentes dans PP selon la
  // cascade interventions confirmées → historique validé → ledger heures.
  const realRate = hoursResolution
    ? realHourlyRateFromResolution({
        ca: k.caYear,
        resolution: hoursResolution,
        targetRate: targetHR,
      })
    : ({ available: false, label: "Taux horaire réel", detail: "Chargement des heures…" } as const);
  const tauxEcartPct =
    realRate.available && targetHR > 0 ? ((realRate.value - targetHR) / targetHR) * 100 : 0;

  // Priorités du jour — classées par volume, ne montre que les non-vides.
  const priorities: Array<{
    key: string;
    label: string;
    count: number;
    icon: typeof Handshake;
    topic?: FocusTopic;
    to?: string;
    search?: Record<string, string>;
    tone: Priority;
  }> = [
    {
      key: "cr",
      label: "Comptes-rendus générés à envoyer",
      count: reportsToSend.length,
      icon: Send,
      topic: "cr-non-envoyes" as FocusTopic,
      tone: "urgent" as Priority,
    },
    {
      key: "crg",
      label: "Comptes-rendus à générer",
      count: reportsToGenerate.length,
      icon: Send,
      topic: "cr-non-envoyes" as FocusTopic,
      tone: "important" as Priority,
    },
    {
      key: "h",
      label: "Interventions sans aucune heure connue",
      count: missingHours.length,
      icon: Clock,
      topic: "heures-manquantes" as FocusTopic,
      tone: "urgent" as Priority,
    },
    {
      key: "r",
      label: "Recommandations à planifier",
      count: acceptedNotPlanned.length,
      icon: Handshake,
      topic: "recos-a-planifier" as FocusTopic,
      tone: "urgent" as Priority,
    },
    {
      key: "d",
      label: "Dépassements de temps",
      count: timeOverruns.length,
      icon: TrendingDown,
      topic: "depassements-temps" as FocusTopic,
      tone: "urgent" as Priority,
    },
    {
      key: "g",
      label: "Objectifs en retard",
      count: goalsLate.length,
      icon: Flag,
      to: "/pilot/objectifs",
      search: { filter: "retard" },
      tone: "urgent" as Priority,
    },
    {
      key: "ca",
      label: "Rapprochements CA à valider",
      count: orphanCount.data ?? 0,
      icon: Link2,
      to: "/pilot/rapprochement",
      tone: "important" as Priority,
    },
    {
      key: "hh",
      label: "Heures historiques à rattacher",
      count: (historicHours.data ?? []).filter((h) => h.status === "a_valider").length,
      icon: Clock,
      to: "/pilot/rapprochement",
      tone: "important" as Priority,
    },
  ]
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  // Risques — condensés, seuls les non-vides.
  const risks: Array<{
    key: string;
    label: string;
    count: number;
    hint: string;
    icon: typeof AlertTriangle;
    topic: FocusTopic;
  }> = [
    {
      key: "low",
      label: "Prestations sous le seuil de rentabilité horaire",
      count: lowHourlyEntries.length,
      hint:
        targetHR > 0
          ? `Lignes CA dont le taux horaire est inférieur à ${formatEuro(targetHR)}/h`
          : "Définir un taux horaire cible dans les paramètres",
      icon: Gauge,
      topic: "rentabilite-faible" as FocusTopic,
    },
    {
      key: "chr",
      label: "Clients chronophages à analyser",
      count: heavyLowMarginClients.length,
      hint: "≥ 20 h/an et taux < 85 % de la cible",
      icon: Flame,
      topic: "chronophages" as FocusTopic,
    },
    {
      key: "sl",
      label: "Clients dormants (> 12 mois)",
      count: clientsDormants.length,
      hint: `Clients du référentiel sans activité depuis plus d'un an (sur ${activityRows.length} clients)`,
      icon: Users,
      topic: "dormants" as FocusTopic,
    },
  ].filter((r) => r.count > 0);

  // ---- Points d'attention : uniquement des alertes fiables et expliquées ----
  type Attention = {
    key: string;
    label: string;
    detail: string;
    why: string;
    to?: string;
    topic?: FocusTopic;
  };
  const attentions: Attention[] = [];

  if (caComparison.available && caComparison.value <= -thresholds.baisseActivitePct) {
    attentions.push({
      key: "activite",
      label: "Baisse d'activité",
      detail: `CA du mois en recul de ${Math.abs(caComparison.value).toFixed(0)} % vs ${year - 1}.`,
      why: `PP compare le CA du mois en cours au même mois de ${year - 1} ; le recul dépasse le seuil de ${thresholds.baisseActivitePct} % défini dans les paramètres.`,
      to: "/pilot/ca",
    });
  }
  if (goalsLate.length > 0) {
    attentions.push({
      key: "objectifs",
      label: "Objectif en retard",
      detail: `${goalsLate.length} objectif(s) dont l'échéance est dépassée.`,
      why: "Objectifs encore « en cours » dans pilot_goals avec une échéance antérieure à aujourd'hui.",
      to: "/pilot/objectifs",
    });
  }
  if (chargesPrevYearProrata > 0) {
    const derive =
      ((projection.chargesReelles - chargesPrevYearProrata) / chargesPrevYearProrata) * 100;
    if (derive >= thresholds.deriveChargesPct) {
      attentions.push({
        key: "charges",
        label: "Dérive des charges",
        detail: `Charges à date ${formatEuro(projection.chargesReelles)} soit +${derive.toFixed(0)} % vs même période ${year - 1}.`,
        why: `PP compare les charges enregistrées sur ${projection.monthsObserved} mois à la même fraction de l'exercice ${year - 1} ; le seuil de dérive est de ${thresholds.deriveChargesPct} %.`,
        to: "/pilot/charges",
      });
    }
  }
  const clientsChronophages = clientsProfit.filter((c) => c.classe === "chronophage");
  if (clientsChronophages.length > 0) {
    attentions.push({
      key: "clients",
      label: "Client à surveiller",
      detail: `${clientsChronophages.length} client(s) chronophages — ex. ${clientsChronophages[0].name}.`,
      why: clientsChronophages[0].why,
      topic: "chronophages" as FocusTopic,
    });
  }
  const servicesFaibles = services.filter((s) => s.classe === "faible");
  if (servicesFaibles.length > 0) {
    attentions.push({
      key: "prestations",
      label: "Prestation peu rentable",
      detail: `${servicesFaibles.length} prestation(s) sous la cible — ex. ${servicesFaibles[0].prestation}.`,
      why: servicesFaibles[0].why,
      to: "/pilot/prestations",
    });
  }

  // ---- Opportunités préparées ----
  const prestationsADevelopper = services
    .filter((s) => s.classe === "rentable" || s.classe === "strategique")
    .sort((a, b) => (b.tauxHoraire ?? 0) - (a.tauxHoraire ?? 0))
    .slice(0, 4);

  // Opportunités — Top 3 NBO déjà scorées ≥ 80.
  const topOffers = priority.slice(0, 3);

  // Signaux commerciaux annexes (chips)
  const secondarySignals: Array<{
    label: string;
    count: number;
    topic: FocusTopic;
  }> = [
    {
      label: "Créations sans entretien",
      count: creationSansEntretien.length,
      topic: "creation-sans-entretien" as FocusTopic,
    },
    {
      label: "Entretien sans conseil récent",
      count: entretienSansConseil.length,
      topic: "entretien-sans-conseil" as FocusTopic,
    },
    {
      label: "Clients à relancer (> 6 mois)",
      count: clientsARelancer.length,
      topic: "dormants" as FocusTopic,
    },
  ].filter((s) => s.count > 0);

  // Éléments à qualifier (jamais des retards) — clients dont la politique CR
  // n'est pas encore tranchée.
  const crToQualifyCount = crToQualify.size;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Bonjour, voici votre journée
        </h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <CaStatusCard
        year={year}
        caYear={k.caYear}
        caPrevYear={k.caPrevYear}
        projection={k.projection}
      />

      {/* 1 — Où en est mon entreprise aujourd'hui ? */}
      <section className="space-y-2">
        <SectionTitle
          question="Situation actuelle"
          label={isProjection ? `Projection ${year}` : `Réel ${year}`}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label={isProjection ? `CA projeté ${year}` : `CA réalisé ${year}`}
            value={formatEuro(caLecture)}
            icon={Euro}
            to="/pilot/ca"
            sub={
              isProjection
                ? `Réel à date ${formatEuro(projection.caReel)}`
                : caComparison.available
                  ? `${caComparison.value >= 0 ? "+" : ""}${caComparison.value.toFixed(0)} % vs ${year - 1} (mois)`
                  : caComparison.detail
            }
            description={isProjection ? projection.explanation : undefined}
          />
          <KpiCard
            label={`Objectif ${year}`}
            value={objectifAnnuel > 0 ? formatEuro(objectifAnnuel) : "—"}
            icon={Flag}
            to="/pilot/objectifs"
            sub={
              objectifAnnuel > 0 ? `CA ${year - 1} pris comme référence` : "Pas d'historique N-1"
            }
          />
          <KpiCard
            label="Progression"
            value={progressionAnnuelle == null ? "—" : `${progressionAnnuelle.toFixed(0)} %`}
            icon={CheckCircle2}
            progress={progressionAnnuelle ?? undefined}
            tone={
              progressionAnnuelle == null
                ? "default"
                : progressionAnnuelle >= 100
                  ? "positive"
                  : progressionAnnuelle >= 60
                    ? "default"
                    : "warning"
            }
            sub={
              objectifMois > 0
                ? `Mois : ${avancement.toFixed(0)} % de ${formatEuro(objectifMois)}`
                : undefined
            }
          />
          <KpiCard
            label={isProjection ? "Résultat projeté" : "Résultat à date"}
            value={formatEuro(resultatLecture)}
            icon={Wallet}
            to="/pilot/finance"
            tone={
              resultatLecture <= 0
                ? "warning"
                : margeLecture != null && margeLecture >= thresholds.margeMin
                  ? "positive"
                  : "default"
            }
            sub={`CA ${formatEuro(caLecture)} − charges ${formatEuro(chargesLecture)}${margeLecture != null ? ` · marge ${margeLecture.toFixed(0)} %` : ""}`}
          />
          <KpiCard
            label="Taux horaire réel"
            value={realRate.available ? `${formatEuro(realRate.value)}/h` : "Non disponible"}
            icon={Gauge}
            to="/pilot/taux"
            description={realRate.available ? realRate.note : realRate.detail}
            tone={
              realRate.available && targetHR > 0
                ? realRate.value >= targetHR
                  ? "positive"
                  : "warning"
                : "default"
            }
            sub={
              realRate.available && targetHR > 0
                ? `${tauxEcartPct >= 0 ? "+" : ""}${tauxEcartPct.toFixed(0)} % vs cible ${formatEuro(targetHR)}`
                : realRate.available
                  ? realRate.note
                  : realRate.detail
            }
          />
        </div>
      </section>

      {/* 2 — Quelles sont mes priorités ? */}
      <section className="space-y-2">
        <SectionTitle question="Répartition du temps" label="Heures consolidées" />
        <HoursSummaryCards year={year} resolution={hoursResolution} toFill={missingHours.length} />
      </section>

      <section className="space-y-2">
        <SectionTitle question="Quelles sont mes priorités ?" label="Priorités du jour" />
        {priorities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">
                Aucune action urgente. Concentrez-vous sur les opportunités.
              </p>
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
                search={p.search}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3 — Quels risques dois-je traiter ? */}
      <section className="space-y-2">
        <SectionTitle question="Points d'attention" label="Alertes expliquées" />
        {attentions.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {attentions.map((a) => {
              const body = (
                <Card className="h-full border-orange-200 bg-orange-50/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-orange-700" />
                    <p className="text-sm font-medium">{a.label}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
                  <p className="mt-2 rounded-md bg-background/70 px-2 py-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Pourquoi PP affiche cette information ?{" "}
                    </span>
                    {a.why}
                  </p>
                </Card>
              );
              if (a.topic) {
                return (
                  <Link key={a.key} to="/pilot/focus/$topic" params={{ topic: a.topic }}>
                    {body}
                  </Link>
                );
              }
              return (
                <Link key={a.key} to={(a.to ?? "/pilot") as string}>
                  {body}
                </Link>
              );
            })}
          </div>
        )}
        {risks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">
                Aucun risque détecté avec les seuils actuels.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {risks.map((r) => (
              <RiskCard
                key={r.key}
                icon={r.icon}
                title={r.label}
                count={r.count}
                hint={r.hint}
                topic={r.topic}
              />
            ))}
          </div>
        )}
        {crToQualifyCount > 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <Send className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {crToQualifyCount} client{crToQualifyCount > 1 ? "s" : ""} à qualifier : indiquez
                s'ils sont concernés par l'envoi de comptes-rendus (aucun retard comptabilisé).
              </p>
              <Link
                to="/clients"
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Qualifier <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 4 — Quelles opportunités puis-je saisir ? */}
      <section className="space-y-2">
        <SectionTitle
          question="Opportunités"
          label="Relances, ventes additionnelles, prestations"
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <h4 className="font-medium">Top offres à proposer</h4>
                <Badge variant="secondary" className="ml-auto">
                  {priority.length}
                </Badge>
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
                        <Badge variant="outline" className="shrink-0">
                          {s.count}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-medium">Prestations complémentaires à développer</h4>
            </div>
            {prestationsADevelopper.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas encore assez de lignes CA et d'heures pour classer une prestation comme
                rentable.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {prestationsADevelopper.map((p) => (
                  <li key={p.prestation} className="rounded-lg border border-border/60 p-2.5">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.prestation}</p>
                      <Badge variant="secondary" className="tabular-nums">
                        {p.tauxHoraire == null ? "—" : `${formatEuro(p.tauxHoraire)}/h`}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.why}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/pilot/prestations"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir la rentabilité par prestation <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ question, label }: { question: string; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-serif text-lg font-semibold tracking-tight">{question}</h3>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function PriorityRow({
  rank,
  icon: Icon,
  label,
  count,
  topic,
  to,
  search,
}: {
  rank: number;
  icon: typeof Handshake;
  label: string;
  count: number;
  topic?: FocusTopic;
  to?: string;
  search?: Record<string, string>;
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
    return (
      <Link to="/pilot/focus/$topic" params={{ topic }}>
        {inner}
      </Link>
    );
  }
  return (
    <Link to={(to ?? "/pilot") as string} search={search as never}>
      {inner}
    </Link>
  );
}

function RiskCard({
  icon: Icon,
  title,
  count,
  hint,
  topic,
}: {
  icon: typeof AlertTriangle;
  title: string;
  count: number;
  hint: string;
  topic: FocusTopic;
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
