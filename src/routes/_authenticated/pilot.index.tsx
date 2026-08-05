import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { PilotCard } from "@/components/pilot/PilotCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { computeKpis, clientStatsWithHours, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { listAllInterventions } from "@/lib/interventions";
import { listAllRecommendations } from "@/lib/garden";
import { listGoals } from "@/lib/pilot-goals";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_ACTIVITY_RULES, fetchClientActivityRows } from "@/lib/client-activity";
import { realHourlyRateFromResolution, marginPct, periodComparison } from "@/lib/pilot-reliability";
import { toDateVsSameDateLastYear } from "@/lib/pilot-compare";
import { fetchHoursLedger, formatHours } from "@/lib/pilot-hours-ledger";
import { resolveRealHours, interventionsNeedingHours } from "@/lib/pilot-real-hours";
import type { FocusTopic } from "@/lib/pilot-focus";
import { countOrphanEntries } from "@/lib/pilot-ca-matching";
import { listHistoricHours } from "@/lib/pilot-historic-hours";
import { listChargeRows, operatingCharges } from "@/lib/pilot-charges";
import { projectYear } from "@/lib/pilot-projection";
import { usePilotMode } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { classifyClients, strategicClients } from "@/lib/pilot-client-profitability";
import { useEntityStatuses } from "@/lib/pilot-entity-rules";
import { analyzeServices } from "@/lib/pilot-service-profitability";
import { buildRecommendations } from "@/lib/pilot-recommendations";
import { priorityStatusKey } from "@/lib/pilot-priorities";
import { PriorityCard } from "@/components/pilot/PriorityCard";
import { OpportunitiesBoard } from "@/components/pilot/OpportunitiesBoard";
import { CeevWatchCard } from "@/components/pilot/CeevWatchCard";
import { rankItems } from "@/lib/pilot-learning";
import { buildDecisions } from "@/lib/pilot-decisions";
import { buildRisks } from "@/lib/pilot-risks";
import { DecisionCenter } from "@/components/pilot/DecisionCenter";
import { buildCommercialOpportunities } from "@/lib/pilot-opportunities";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import { DashboardCustomizer, DashboardBlock } from "@/components/pilot/DashboardCustomizer";
import { explainPriority } from "@/lib/pilot-priorities";
import {
  ACTION_STATUS_BADGE,
  ACTION_STATUS_LABELS,
  useActionStatuses,
  type ActionStatus,
} from "@/lib/pilot-action-status";
import { listCeevContracts } from "@/lib/ceev";
import {
  chargeRowsForMode,
  entriesForMode,
  goalsForMode,
  hoursLedgerForMode,
  todayIso,
} from "@/lib/pilot-realized";
import { annualSummary } from "@/lib/pilot-annual";
import {
  listAlertFeedback,
  markAlertSeen,
  rateAlert,
  alertKeyFrom,
  averageRating,
  type AlertFeedback,
} from "@/lib/pilot-alert-feedback";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PP_COLORS } from "@/lib/pilot-colors";
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
  Star,
  Eye,
  Lightbulb,
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

  const alertFeedback = useQuery({
    queryKey: ["pilot-alert-feedback"],
    queryFn: listAlertFeedback,
  });
  const ceevContracts = useQuery({ queryKey: ["ceev-contracts"], queryFn: listCeevContracts });
  const queryClient = useQueryClient();
  const seenMutation = useMutation({
    mutationFn: ({ alertKey, seen }: { alertKey: string; seen: boolean }) =>
      markAlertSeen(alertKey, seen),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pilot-alert-feedback"] });
      toast.success(vars.seen ? "Alerte marquée comme vue" : "Alerte remise en attention");
    },
    onError: () => toast.error("Impossible d'enregistrer ce retour"),
  });
  const rateMutation = useMutation({
    mutationFn: ({ alertKey, rating }: { alertKey: string; rating: number }) =>
      rateAlert(alertKey, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilot-alert-feedback"] });
      toast.success("Merci pour votre retour");
    },
    onError: () => toast.error("Impossible d'enregistrer la note"),
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
  const realEntries = useMemo(() => entriesForMode(entries.data ?? [], mode), [entries.data, mode]);
  const ledgerRows = useMemo(
    () => (hoursLedger.data ? hoursLedgerForMode(hoursLedger.data, mode) : []),
    [hoursLedger.data, mode],
  );
  const hoursResolution = useMemo(
    () => (hoursLedger.data ? resolveRealHours(ledgerRows, year) : undefined),
    [hoursLedger.data, ledgerRows, year],
  );
  const confirmedHoursByClient = useMemo(
    () => hoursResolution?.byClient ?? new Map<string, number>(),
    [hoursResolution],
  );

  const k = useMemo(
    () =>
      computeKpis({
        entries: entries.data ?? [],
        charges: charges.data ?? [],
        settings: set,
        year,
        month,
        confirmedHoursByClient,
        mode,
      }),
    [entries.data, charges.data, set, year, month, confirmedHoursByClient, mode],
  );

  // Objectif du mois = CA du même mois N-1 (référentiel factuel, aucune nouvelle donnée)
  const objectifMois = useMemo(() => {
    const rows = realEntries.filter((e) => {
      const d = new Date(e.entry_date);
      return d.getFullYear() === year - 1 && d.getMonth() === month;
    });
    return rows.reduce((s, e) => s + e.amount_ht, 0);
  }, [realEntries, year, month]);
  const avancement = objectifMois > 0 ? (k.caMonth / objectifMois) * 100 : 0;

  // Comparatifs V2.2 : uniquement à périmètre égal (mois N vs même mois N-1,
  // cumul au jour J vs même date N-1). La comparaison à la fin de l'exercice
  // précédent est supprimée : elle opposait un exercice incomplet à un
  // exercice complet et faussait la lecture.
  const toDateCompare = useMemo(() => toDateVsSameDateLastYear(entries.data ?? []), [entries.data]);

  const allI = (interventions.data ?? []).filter(
    (i) => !i.intervention_date || i.intervention_date.slice(0, 10) <= todayIso(),
  );
  const allR = recos.data ?? [];
  const allG = goalsForMode(goals.data ?? [], mode);

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
  // Une intervention n'est « à renseigner » que si AUCUNE heure n'existe dans PP
  // pour ce client sur l'année : un défaut de liaison n'est jamais une tâche.
  const missingHours = useMemo(
    () => (hoursLedger.data ? interventionsNeedingHours(allI, ledgerRows, year) : []),
    [allI, hoursLedger.data, ledgerRows, year],
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

  // ---- Lecture unique : données réelles enregistrées (aucune extrapolation) ----
  const projection = useMemo(
    () => projectYear({ entries: entries.data ?? [], charges: chargeRows.data ?? [], year }),
    [entries.data, chargeRows.data, year],
  );
  const caLecture = projection.caReel;
  // Bénéfice = CA − charges d'exploitation hors investissements, via le moteur
  // annualSummary (référentiel unique du bénéfice dans tout Pilot Pro).
  const annualRows = useMemo(
    () => annualSummary(entries.data ?? [], chargeRows.data ?? [], { mode }),
    [entries.data, chargeRows.data, mode],
  );
  const annualCurrent = annualRows.find((r) => r.year === year);
  const chargesLecture = annualCurrent?.charges ?? 0;
  const resultatLecture = annualCurrent?.beneficeBrut ?? 0;
  const margeLecture = annualCurrent?.margePct ?? null;

  // Objectif annuel factuel : CA de l'exercice précédent (aucune saisie requise).
  const objectifAnnuel = useMemo(
    () =>
      realEntries
        .filter((e) => new Date(e.entry_date).getFullYear() === year - 1)
        .reduce((s, e) => s + (Number(e.amount_ht) || 0), 0),
    [realEntries, year],
  );
  const progressionAnnuelle = objectifAnnuel > 0 ? (caLecture / objectifAnnuel) * 100 : null;

  // Classement rentabilité (clients / prestations) — sert aux points d'attention.
  const statusesQ = useEntityStatuses();
  // Seules les entités économiquement exploitables alimentent les points
  // d'attention : un contact ou un doublon ne doit jamais polluer les analyses.
  const clientsProfit = useMemo(
    () =>
      hoursLedger.data
        ? strategicClients(
            classifyClients({
              entries: realEntries,
              ledger: ledgerRows,
              year,
              targetHourlyRate: set.target_hourly_rate || 0,
              thresholds,
              statuses: statusesQ.data,
            }),
          )
        : [],
    [
      realEntries,
      hoursLedger.data,
      ledgerRows,
      year,
      set.target_hourly_rate,
      thresholds,
      statusesQ.data,
    ],
  );
  const services = useMemo(
    () =>
      hoursLedger.data
        ? analyzeServices({
            entries: realEntries,
            ledger: ledgerRows,
            year,
            targetHourlyRate: set.target_hourly_rate || 0,
            thresholds,
          })
        : [],
    [realEntries, hoursLedger.data, ledgerRows, year, set.target_hourly_rate, thresholds],
  );

  // Dérive des charges : charges à date vs même part d'exercice en N-1.
  const chargesPrevYearProrata = useMemo(() => {
    const prev = (chargeRows.data ?? []).filter((r) => r.year === year - 1);
    const total = prev.reduce((s, r) => s + r.amount_ht, 0);
    return total > 0 ? (total * projection.monthsObserved) / 12 : 0;
  }, [chargeRows.data, year, projection.monthsObserved]);

  // Données graphiques « Aujourd'hui » : CA mensuel (réel/projeté) et CA cumulé
  // vs objectif annuel (CA N-1), à partir du moteur de projection existant.

  // Nom client par ID (pour opportunités et priorités affichées)
  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of realEntries) {
      if (e.client_id && e.client_name) map.set(e.client_id, e.client_name);
    }
    return map;
  }, [realEntries]);

  // ------- Nouvelles analyses (aucune nouvelle donnée) -------
  const targetHR = set.target_hourly_rate || 0;

  // Aucune notion de « temps prévu / théorique » dans Pilot Pro : les
  // comparaisons de temps passé à une moyenne de type d'intervention ont été
  // supprimées (indicateur non vérifiable, trompeur pour le pilotage).

  // CA agrégé par client sur l'année (pour taux horaire réel par client)
  const caByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of realEntries) {
      if (!e.client_id) continue;
      if (new Date(e.entry_date).getFullYear() !== year) continue;
      map.set(e.client_id, (map.get(e.client_id) ?? 0) + e.amount_ht);
    }
    return map;
  }, [realEntries, year]);

  // Lignes CA dont la rentabilité horaire est sous la cible.
  // Priorité : taux horaire réel du client (CA client / heures confirmées) quand disponible ;
  // à défaut, ratio de la ligne (amount_ht / hours vendues).
  const lowHourlyEntries = useMemo(() => {
    if (targetHR <= 0) return [];
    return realEntries.filter((e) => {
      const realHours = e.client_id ? (confirmedHoursByClient.get(e.client_id) ?? 0) : 0;
      if (realHours > 0 && e.client_id) {
        const clientCa = caByClient.get(e.client_id) ?? 0;
        if (clientCa <= 0) return false;
        return clientCa / realHours < targetHR;
      }
      return e.hours > 0 && e.amount_ht / e.hours < targetHR;
    });
  }, [realEntries, targetHR, confirmedHoursByClient, caByClient]);

  // Clients A/B avec ratio horaire dégradé (basé sur heures réellement passées)
  const cstats = useMemo(
    () => clientStatsWithHours(realEntries, year, confirmedHoursByClient),
    [realEntries, year, confirmedHoursByClient],
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
    for (const e of realEntries) {
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
  }, [realEntries]);

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
      goalsLate.length,
    important:
      clientsARelancer.length +
      clientsDormants.length +
      heavyLowMarginClients.length +
      entretienSansConseil.length +
      creationSansEntretien.length +
      (lowHourlyEntries.length > 0 ? 1 : 0),
    opportunite: nboClients.size + acceptedNotPlanned.length,
  };

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

  // ---- Synthèses de lecture (aucune projection, uniquement l'enregistré) ----
  /** Libellé de période « Du 1er août au 5 août 2026 ». */
  const moisPeriodeLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const first = new Date(year, month, 1);
    return `Du ${fmt(first).replace(/^1 /, "1er ")} au ${fmt(now)}`;
  }, [year, month, now]);
  const moisCourtLabel = useMemo(
    () => `du 1er au ${now.getDate()} ${now.toLocaleDateString("fr-FR", { month: "long" })}`,
    [now],
  );

  /** Interventions terminées : mois en cours et cumul de l'exercice. */
  const interventionsMois = useMemo(
    () =>
      allI.filter((i) => {
        if (i.status !== "terminee" || !i.intervention_date) return false;
        const d = new Date(i.intervention_date);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length,
    [allI, year, month],
  );
  const interventionsAnnee = useMemo(
    () =>
      allI.filter((i) => {
        if (i.status !== "terminee" || !i.intervention_date) return false;
        return new Date(i.intervention_date).getFullYear() === year;
      }).length,
    [allI, year],
  );

  // ---- Comparatifs à date équivalente N-1 (uniquement l'enregistré) ----
  // CA : lignes de vente enregistrées (pilot_ca_entries).
  // Interventions : statut « terminée » (interventions).
  // Heures : interventions.hours_spent non estimées uniquement. Les heures
  // vendues et les heures historiques importées n'ont pas de précision au
  // jour : elles ne sont jamais mélangées dans ces comparatifs.
  const comparatifs = useMemo(() => {
    const dayOfYear = (d: Date) =>
      Math.floor(
        (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) /
          86_400_000,
      );
    const limitDoy = dayOfYear(now);
    const limitDay = now.getDate();

    const ca = (keep: (d: Date) => boolean) =>
      realEntries.reduce((s, e) => {
        const d = new Date(e.entry_date);
        return Number.isFinite(d.getTime()) && keep(d) ? s + (Number(e.amount_ht) || 0) : s;
      }, 0);
    const nbItv = (keep: (d: Date) => boolean) =>
      allI.filter(
        (i) =>
          i.status === "terminee" && i.intervention_date && keep(new Date(i.intervention_date)),
      ).length;
    const heures = (keep: (d: Date) => boolean) =>
      allI.reduce((s, i) => {
        if (i.status !== "terminee" || i.hours_spent == null || !i.intervention_date) return s;
        const meta = i.ai_metadata as Record<string, unknown> | null;
        if (meta && meta["hours_spent_estimated"] === true) return s;
        return keep(new Date(i.intervention_date)) ? s + Number(i.hours_spent) : s;
      }, 0);

    const moisN = (d: Date) =>
      d.getFullYear() === year && d.getMonth() === month && d.getDate() <= limitDay;
    const moisN1 = (d: Date) =>
      d.getFullYear() === year - 1 && d.getMonth() === month && d.getDate() <= limitDay;
    const anneeN = (d: Date) => d.getFullYear() === year && dayOfYear(d) <= limitDoy;
    const anneeN1 = (d: Date) => d.getFullYear() === year - 1 && dayOfYear(d) <= limitDoy;

    const build = (cur: (d: Date) => boolean, prev: (d: Date) => boolean) => [
      {
        key: "ca",
        label: "CA facturé",
        current: ca(cur),
        previous: ca(prev),
        fmt: (v: number) => formatEuro(v),
      },
      {
        key: "itv",
        label: "Interventions terminées",
        current: nbItv(cur),
        previous: nbItv(prev),
        fmt: (v: number) => String(Math.round(v)),
      },
      {
        key: "h",
        label: "Heures réalisées",
        current: heures(cur),
        previous: heures(prev),
        fmt: (v: number) => formatHours(v),
      },
    ];

    return { mois: build(moisN, moisN1), annee: build(anneeN, anneeN1) };
  }, [realEntries, allI, year, month, now]);

  /**
   * Heures réalisées — source unique et vérifiable : interventions terminées
   * avec heures confirmées (les heures estimées sont exclues). Mêmes chiffres
   * que les comparatifs ci-dessus, aucune autre source mélangée.
   */
  const heuresRealiseesMois = comparatifs.mois.find((i) => i.key === "h")?.current ?? 0;
  const heuresRealiseesAnnee = comparatifs.annee.find((i) => i.key === "h")?.current ?? 0;

  /**
   * Évolution mensuelle réelle depuis le 1er janvier : CA HT enregistré et
   * bénéfice (CA − charges d'exploitation enregistrées, hors investissements).
   * Seuls les mois écoulés sont présents : aucune projection, aucune estimation.
   */
  const monthlyPerformance = useMemo(() => {
    const caByMonth = new Array(12).fill(0) as number[];
    for (const e of realEntries) {
      const d = new Date(e.entry_date);
      if (!Number.isFinite(d.getTime()) || d.getFullYear() !== year) continue;
      caByMonth[d.getMonth()] += Number(e.amount_ht) || 0;
    }
    const chargesByMonth = new Array(12).fill(0) as number[];
    for (const c of operatingCharges(chargeRowsForMode(chargeRows.data ?? [], mode))) {
      if (c.year !== year || c.is_investment) continue;
      const idx = Number(c.month) - 1;
      if (idx < 0 || idx > 11) continue;
      chargesByMonth[idx] += Number(c.amount_ht) || 0;
    }
    const labels = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
    return labels
      .slice(0, month + 1)
      .map((mois, i) => ({
        mois,
        "CA HT": caByMonth[i],
        Bénéfice: caByMonth[i] - chargesByMonth[i],
      }))
      .filter((r, i) => caByMonth[i] !== 0 || chargesByMonth[i] !== 0);
  }, [realEntries, chargeRows.data, mode, year, month]);

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
  const attentionsRaw: Attention[] = [];
  const attentions = attentionsRaw;

  if (caComparison.available && caComparison.value <= -thresholds.baisseActivitePct) {
    attentionsRaw.push({
      key: "activite",
      label: "Baisse d'activité",
      detail: `CA du mois en recul de ${Math.abs(caComparison.value).toFixed(0)} % vs ${year - 1}.`,
      why: `PP compare le CA du mois en cours au même mois de ${year - 1} ; le recul dépasse le seuil de ${thresholds.baisseActivitePct} % défini dans les paramètres.`,
      to: "/pilot/ca",
    });
  }
  if (goalsLate.length > 0) {
    attentionsRaw.push({
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
      attentionsRaw.push({
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
    attentionsRaw.push({
      key: "clients",
      label: "Client à surveiller",
      detail: `${clientsChronophages.length} client(s) chronophages — ex. ${clientsChronophages[0].name}.`,
      why: clientsChronophages[0].why,
      topic: "chronophages" as FocusTopic,
    });
  }
  const servicesFaibles = services.filter((s) => s.classe === "faible");
  if (servicesFaibles.length > 0) {
    attentionsRaw.push({
      key: "prestations",
      label: "Prestation peu rentable",
      detail: `${servicesFaibles.length} prestation(s) sous la cible — ex. ${servicesFaibles[0].prestation}.`,
      why: servicesFaibles[0].why,
      to: "/pilot/prestations",
    });
  }

  // Enrichissement des alertes avec le retour utilisateur persisté :
  // clé stable dérivée du contenu, jamais recalculée localement au-delà du tri/affichage.
  const feedbackByKey = useMemo(() => {
    const map = new Map<string, AlertFeedback>();
    for (const f of alertFeedback.data ?? []) map.set(f.alert_key, f);
    return map;
  }, [alertFeedback.data]);
  const attentionsWithFeedback = useMemo(
    () =>
      attentionsRaw
        .map((a) => {
          const alertKey = alertKeyFrom(a);
          const feedback = feedbackByKey.get(alertKey);
          return {
            ...a,
            alertKey,
            seen: Boolean(feedback?.seen_at),
            rating: feedback?.rating ?? null,
          };
        })
        .sort((a, b) => Number(a.seen) - Number(b.seen)),
    [attentionsRaw, feedbackByKey],
  );
  const alertsAvgRating = useMemo(
    () => averageRating(alertFeedback.data ?? []),
    [alertFeedback.data],
  );

  // ---- Opportunités préparées ----
  const prestationsADevelopper = services
    .filter((s) => s.classe === "rentable" || s.classe === "strategique")
    .sort((a, b) => (b.tauxHoraire ?? 0) - (a.tauxHoraire ?? 0))
    .slice(0, 4);

  // Opportunités — Top 3 NBO déjà scorées ≥ 80.
  const topOffers = priority.slice(0, 3);

  // ---- Recommandations Pilot Pro (moteur dédié, sources tracées) ----
  const caMoyenParClient = (() => {
    const byClient = new Map<string, number>();
    for (const e of realEntries) {
      if (!e.client_id) continue;
      if (new Date(e.entry_date).getFullYear() !== year) continue;
      byClient.set(e.client_id, (byClient.get(e.client_id) ?? 0) + (Number(e.amount_ht) || 0));
    }
    if (byClient.size === 0) return 0;
    let total = 0;
    for (const v of byClient.values()) total += v;
    return total / byClient.size;
  })();
  const { statusOf, setStatus, snoozeAction } = useActionStatuses();
  const recommendationsRaw = buildRecommendations({
    year,
    targetHourlyRate: targetHR,
    clients: clientsProfit,
    services,
    ceevContracts: ceevContracts.data ?? [],
    acceptedNotPlanned: acceptedNotPlanned.map((r) => ({ id: r.id, unit_price: r.unit_price })),
    clientsARelancer: clientsARelancer.length,
    clientsDormants: clientsDormants.length,
    caMoyenParClient,
  });
  // Apprentissage : les recommandations déjà traitées ou notées faiblement
  // descendent, celles jugées utiles remontent. Rien n'est supprimé.
  const recommendations = rankItems(recommendationsRaw, { feedbackByKey, statusOf });

  // ---- Centre de décision : agrégation des moteurs existants uniquement ----
  const activityRowsQ = useQuery({
    queryKey: ["client-activity-rows"],
    queryFn: fetchClientActivityRows,
  });
  const commercialOpportunities = buildCommercialOpportunities({
    activity: activityRowsQ.data ?? [],
    ceev: ceevContracts.data ?? [],
    offers: priority,
    clientNameById,
    year,
  });
  // Risques détectés automatiquement à partir des moteurs existants.
  const autoRisks = useMemo(
    () =>
      buildRisks({
        year,
        annual: annualRows,
        clients: clientsProfit,
        services,
        ceev: ceevContracts.data ?? [],
        caYear: k.caYear,
        caPrevYear: k.caPrevYear,
        tauxHoraireReel: k.tauxHoraireReel,
        targetHourlyRate: targetHR,
      }),
    [
      year,
      annualRows,
      clientsProfit,
      services,
      ceevContracts.data,
      k.caYear,
      k.caPrevYear,
      k.tauxHoraireReel,
      targetHR,
    ],
  );
  const decisions = buildDecisions({
    recommendations,
    opportunities: commercialOpportunities,
    risks: autoRisks,
    priorities: priorities
      .filter((p) => p.count > 0)
      .map((p) => {
        const info = explainPriority(p.key);
        return {
          key: p.key,
          label: p.label,
          count: p.count,
          why: info.why,
          source: info.source,
          action: info.action,
          to: p.topic ? "/pilot/focus/$topic" : (p.to ?? "/pilot"),
          params: p.topic ? { topic: p.topic } : undefined,
          weight: 50 + Math.min(40, p.count * 5),
          isDataFix: p.key === "ca" || p.key === "hh" || p.key === "h",
        };
      }),
    isHandled: (key) => {
      const s = statusOf(key);
      return s === "realisee" || s === "ignoree" || s === "reportee";
    },
  });

  const dashboardDefs: DashboardBlockDef[] = [
    { id: "mois", label: "Synthèse du mois en cours" },
    { id: "exercice", label: "Synthèse depuis le début de l'exercice" },
    { id: "situation", label: "Situation actuelle" },
    { id: "priorites", label: "Priorités du jour" },
  ];
  const layout = useDashboardLayout(dashboardDefs);

  // Priorités classées (moteur d'apprentissage existant). Seules les deux
  // premières sont visibles par défaut : l'écran reste lisible, le reste est
  // accessible par « Afficher tout ».
  const rankedPriorities = rankItems(
    priorities.map((p) => ({
      ...p,
      key: priorityStatusKey(p.key),
      rawKey: p.key,
      weight: p.count,
    })),
    { statusOf },
  );
  const [showAllPriorities, setShowAllPriorities] = useState(false);

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

  // Écran de chargement : placé après tous les hooks (ordre des hooks stable).
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
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
        <DashboardCustomizer defs={dashboardDefs} layout={layout} />
      </div>

      {/* 1 — Synthèse du mois en cours : premier bloc (données enregistrées) */}
      <DashboardBlock id="mois" layout={layout}>
        <SectionTitle question="Vue mois" label={moisPeriodeLabel} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <PilotCard
            label="CA réalisé du mois"
            value={formatEuro(k.caMonth)}
            icon={Euro}
            to="/pilot/ca"
            help="Somme des lignes CA facturées du 1er du mois à aujourd'hui. Aucune projection."
            sub={
              objectifMois > 0
                ? `${avancement.toFixed(0)} % du même mois ${year - 1} (${formatEuro(objectifMois)})`
                : `Aucune référence en ${year - 1}`
            }
          />
          <PilotCard
            label="Interventions réalisées"
            value={String(interventionsMois)}
            icon={Leaf}
            to="/interventions"
            help="Interventions terminées et enregistrées sur le mois en cours."
          />
          <PilotCard
            label="Heures réalisées"
            value={heuresRealiseesMois > 0 ? formatHours(heuresRealiseesMois) : "Non renseignées"}
            icon={Clock}
            to="/pilot/temps"
            help="Heures réelles saisies sur les interventions du mois (ledger consolidé). Affiché uniquement si des heures existent."
          />
        </div>
        <CompareBars
          items={comparatifs.mois}
          currentLabel={`${moisCourtLabel} ${year}`}
          previousLabel={`${moisCourtLabel} ${year - 1}`}
          note={`Comparaison à date équivalente : du 1er au ${now.getDate()} du mois, ${year} vs ${year - 1}. Heures issues des interventions terminées (heures confirmées).`}
        />
        {missingHours.length > 0 && (
          <Card className="border-amber-300/70 bg-amber-50/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <span>
                <strong>{missingHours.length}</strong> intervention
                {missingHours.length > 1 ? "s" : ""} terminée{missingHours.length > 1 ? "s" : ""}{" "}
                sans heures réelles.
              </span>
              <Link to="/interventions" className="ml-auto font-medium text-primary underline">
                Saisir les heures
              </Link>
            </div>
          </Card>
        )}
      </DashboardBlock>

      {/* 2 — Synthèse depuis le début de l'exercice */}
      <DashboardBlock id="exercice" layout={layout}>
        <SectionTitle
          question="Vue exercice"
          label={`Depuis le 1er janvier ${year}`}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PilotCard
            label={`CA cumulé ${year}`}
            value={formatEuro(caLecture)}
            icon={Euro}
            to="/pilot/ca"
            help="Cumul des lignes CA facturées depuis le 1er janvier, à date."
            sub={
              toDateCompare.deltaPct != null
                ? `${toDateCompare.deltaPct >= 0 ? "+" : ""}${toDateCompare.deltaPct.toFixed(0)} % ${toDateCompare.label}`
                : `Aucune référence à la même date en ${year - 1}`
            }
          />
          <PilotCard
            label="Bénéfice"
            value={formatEuro(resultatLecture)}
            icon={Wallet}
            to="/pilot/finance"
            help="Bénéfice = CA − charges d'exploitation hors investissements (moteur annualSummary)."
            tone={
              resultatLecture <= 0
                ? "warning"
                : margeLecture != null && margeLecture >= thresholds.margeMin
                  ? "positive"
                  : "default"
            }
            sub={`Charges ${formatEuro(chargesLecture)}${margeLecture != null ? ` · marge ${margeLecture.toFixed(0)} %` : ""}`}
          />
          <PilotCard
            label="Interventions réalisées"
            value={String(interventionsAnnee)}
            icon={Leaf}
            to="/interventions"
            help="Interventions terminées et enregistrées depuis le début de l'exercice."
          />
          <PilotCard
            label="Taux horaire réel"
            value={realRate.available ? `${formatEuro(realRate.value)}/h` : "Non disponible"}
            icon={Gauge}
            to="/pilot/taux"
            help={realRate.available ? realRate.note : realRate.detail}
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
                : undefined
            }
          />
        </div>
        <CompareBars
          items={comparatifs.annee}
          currentLabel={`1er janv. → aujourd'hui ${year}`}
          previousLabel={`1er janv. → même date ${year - 1}`}
          note={`Comparaison à date équivalente depuis le 1er janvier. Aucun exercice complet, aucune projection.`}
        />
      </DashboardBlock>

      {/* 3 — Situation actuelle : deux niveaux de lecture */}
      <DashboardBlock id="situation" layout={layout}>
        <SectionTitle question="Situation actuelle" label={`Réel ${year}`} />
        <Card>
          <CardContent className="divide-y p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Début exercice
                </p>
                <p className="text-sm text-muted-foreground">
                  {interventionsAnnee} intervention{interventionsAnnee > 1 ? "s" : ""}
                  {heuresRealiseesAnnee > 0
                    ? ` · ${formatHours(heuresRealiseesAnnee)} réalisées (heures confirmées sur interventions)`
                    : ""}
                </p>
              </div>
              <p className="font-serif text-2xl font-semibold tabular-nums">
                {formatEuro(caLecture)}
              </p>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mois en cours ({moisCourtLabel})
                </p>
                <p className="text-sm text-muted-foreground">
                  {interventionsMois} intervention{interventionsMois > 1 ? "s" : ""}
                  {heuresRealiseesMois > 0
                    ? ` · ${formatHours(heuresRealiseesMois)} réalisées (heures confirmées sur interventions)`
                    : ""}
                </p>
              </div>
              <p className="font-serif text-2xl font-semibold tabular-nums">
                {formatEuro(k.caMonth)}
              </p>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Source unique : CA facturé enregistré et heures confirmées sur les interventions
          terminées. Les heures vendues (lignes CA) et les heures historiques importées ne sont pas
          comptées ici — elles sont consultables dans le module Temps.
        </p>
      </DashboardBlock>

      {/* Priorités du jour */}
      <DashboardBlock id="priorites" layout={layout}>
        {priorities.length === 0 ? null : (
          <>
            <SectionTitle question="Priorités" label="Actions fiables du jour" />
            <div className="grid gap-2 sm:grid-cols-2">
              {rankedPriorities
                .slice(0, showAllPriorities ? rankedPriorities.length : 2)
                .map((p, idx) => (
                  <PriorityCard
                    key={p.key}
                    rank={idx + 1}
                    itemKey={p.rawKey}
                    icon={p.icon}
                    label={p.label}
                    count={p.count}
                    topic={p.topic}
                    to={p.to}
                    search={p.search}
                    status={statusOf(p.key)}
                    onStatus={(s: ActionStatus) => setStatus(p.key, s)}
                  />
                ))}
            </div>
            {rankedPriorities.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowAllPriorities((v) => !v)}
              >
                {showAllPriorities
                  ? "Réduire aux 2 priorités principales"
                  : `Afficher tout (${rankedPriorities.length} priorités)`}
              </Button>
            )}
          </>
        )}
      </DashboardBlock>
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

/**
 * Comparatif à date équivalente N vs N-1 : un mini histogramme par indicateur
 * fiable. Aucune projection, aucune donnée reconstruite.
 */
function CompareBars({
  items,
  currentLabel,
  previousLabel,
  note,
}: {
  items: Array<{
    key: string;
    label: string;
    current: number;
    previous: number;
    fmt: (v: number) => string;
  }>;
  currentLabel: string;
  previousLabel: string;
  note: string;
}) {
  const visible = items.filter((i) => i.current > 0 || i.previous > 0);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="grid gap-3 sm:grid-cols-3">
        {visible.map((it) => {
          const deltaPct =
            it.previous > 0 ? ((it.current - it.previous) / it.previous) * 100 : null;
          return (
            <Card key={it.key} className="p-3">
              <p className="text-xs font-medium">{it.label}</p>
              <p className="font-serif text-lg font-semibold tabular-nums">{it.fmt(it.current)}</p>
              <div className="h-[110px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: previousLabel, v: it.previous },
                      { name: currentLabel, v: it.current },
                    ]}
                    margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                    <Tooltip formatter={(v: number | string) => it.fmt(Number(v))} />
                    <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                      <Cell fill={PP_COLORS.neutral} />
                      <Cell fill={PP_COLORS.primary} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">
                {deltaPct != null
                  ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)} % vs période équivalente`
                  : "Aucune référence sur la période équivalente"}
              </p>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
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
    <Card className="flex cursor-pointer items-center gap-3 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
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
      <Card className="h-full cursor-pointer border-orange-200 bg-orange-50/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
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
