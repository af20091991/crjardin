import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePilotData } from "@/components/pilot/usePilotData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listAllInterventions, waiveInterventionReport } from "@/lib/interventions";
import { listAllRecommendations } from "@/lib/garden";
import { clientStatsWithHours, fetchConfirmedHoursByClient, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { CLIENT_ACTIVITY_RULES } from "@/lib/client-activity";
import { FOCUS_META, isFocusTopic, type FocusTopic } from "@/lib/pilot-focus";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { interventionsNeedingHours } from "@/lib/pilot-real-hours";
import { entriesForMode, hoursLedgerForMode, todayIso } from "@/lib/pilot-realized";
import { usePilotMode } from "@/lib/pilot-mode";
import { ArrowLeft, ArrowRight, BellOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/focus/$topic")({
  head: ({ params }) => ({
    meta: [{ title: `${FOCUS_META[params.topic as FocusTopic]?.title ?? "Focus"} — Pilot Pro` }],
  }),
  beforeLoad: ({ params }) => {
    if (!isFocusTopic(params.topic)) throw notFound();
  },
  component: FocusPage,
  notFoundComponent: () => (
    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Focus inconnu.</CardContent></Card>
  ),
  errorComponent: ({ error }) => (
    <Card><CardContent className="py-10 text-center text-sm text-destructive">{error.message}</CardContent></Card>
  ),
});

type Row = {
  key: string;
  clientName: string;
  clientId: string | null;
  interventionId?: string;
  columns: { label: string; value: string }[];
  reason: string;
  /** Action « dispense de compte-rendu » disponible sur cette ligne. */
  canWaiveReport?: boolean;
};

function FocusPage() {
  const { topic } = Route.useParams() as { topic: FocusTopic };
  const meta = FOCUS_META[topic];
  const { entries, settings } = usePilotData();
  const { mode } = usePilotMode();
  const qc = useQueryClient();
  const now = new Date();
  const year = now.getFullYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const targetHR = set.target_hourly_rate || 0;

  const interventions = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });
  const recos = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const confirmedHours = useQuery({
    queryKey: ["confirmed-hours-by-client", year],
    queryFn: () => fetchConfirmedHoursByClient(year),
  });
  // Ledger consolidé : une intervention n'est listée que si aucune heure
  // n'existe déjà dans Pilot Pro pour ce client sur l'année.
  const hoursLedger = useQuery({
    queryKey: ["pilot-hours-ledger", year, mode],
    queryFn: () => fetchHoursLedger(year, { mode }),
    enabled: topic === "heures-manquantes",
  });
  const priorityOffers = useQuery({
    queryKey: ["focus-nbo", topic],
    enabled: topic === "opportunites",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_client_next_best_offers" as never)
        .select("client_id, service_id, service_name, category_name, score_opportunity, reason, days_since_last_performed, estimated_value")
        .gte("score_opportunity", 80)
        .order("score_opportunity", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        client_id: string;
        service_name: string;
        category_name: string | null;
        score_opportunity: number;
        reason: string;
        days_since_last_performed: number | null;
        estimated_value: number | null;
      }>;
    },
  });

  const waiveMut = useMutation({
    mutationFn: (id: string) => waiveInterventionReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interventions-all"] });
      toast.success("Compte-rendu dispensé pour cette intervention");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loading =
    entries.isLoading || settings.isLoading || interventions.isLoading ||
    recos.isLoading || confirmedHours.isLoading ||
    (topic === "opportunites" && priorityOffers.isLoading);

  const rows: Row[] = useMemo(() => {
    if (loading) return [];
    const allI = (interventions.data ?? []).filter(
      (i) => mode === "projection" || !i.intervention_date || i.intervention_date.slice(0, 10) <= todayIso(),
    );
    const allR = recos.data ?? [];
    const allE = entriesForMode(entries.data ?? [], mode);
    const confirmedMap = confirmedHours.data ?? new Map<string, number>();

    // Résolveur nom client depuis intervention (via CA entries)
    const nameByClient = new Map<string, string>();
    for (const e of allE) {
      if (e.client_id && e.client_name && !nameByClient.has(e.client_id)) {
        nameByClient.set(e.client_id, e.client_name);
      }
    }

    if (topic === "cr-non-envoyes") {
      return allI
        .filter((i) => i.status === "terminee" && !i.sent_to_client_at && !i.report_waived_at)
        .slice(0, 100)
        .map((i) => ({
          key: i.id,
          clientName: (i.client_id ? nameByClient.get(i.client_id) : null) ?? "Client",
          clientId: i.client_id,
          interventionId: i.id,
          columns: [
            { label: "Date", value: new Date(i.intervention_date).toLocaleDateString("fr-FR") },
            { label: "Type", value: i.intervention_type ?? "—" },
            { label: "Heures", value: i.hours_spent != null ? `${i.hours_spent.toFixed(1)} h` : "—" },
          ],
          reason: "Intervention terminée, aucun CR envoyé au client.",
          canWaiveReport: true,
        }));
    }

    if (topic === "heures-manquantes") {
      return interventionsNeedingHours(allI, hoursLedgerForMode(hoursLedger.data ?? [], mode), year)
        .slice(0, 100)
        .map((i) => ({
          key: i.id,
          clientName: (i.client_id ? nameByClient.get(i.client_id) : null) ?? "Client",
          clientId: i.client_id,
          interventionId: i.id,
          columns: [
            { label: "Date", value: new Date(i.intervention_date).toLocaleDateString("fr-FR") },
            { label: "Heures", value: i.hours_spent != null ? `${i.hours_spent.toFixed(1)} h (estimé)` : "—" },
          ],
          reason:
            "Aucune heure disponible dans Pilot Pro pour ce client sur l'année (ni suivi CA, ni historique).",
        }));
    }

    if (topic === "recos-a-planifier") {
      return allR
        .filter((r) => r.status === "acceptee" && !r.planned_intervention_id)
        .slice(0, 100)
        .map((r) => ({
          key: r.id,
          clientName: r.client_id ? nameByClient.get(r.client_id) ?? "Client" : "—",
          clientId: r.client_id,
          columns: [
            { label: "Prestation", value: r.title ?? "—" },
            { label: "Créée le", value: r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—" },
          ],
          reason: "Recommandation acceptée sans intervention planifiée.",
        }));
    }

    if (topic === "chronophages") {
      if (targetHR <= 0) return [];
      const cstats = clientStatsWithHours(allE, year, confirmedMap);
      return cstats
        .filter((c) => c.hours >= 20 && c.hourlyRate > 0 && c.hourlyRate < targetHR * 0.85)
        .slice(0, 50)
        .map((c) => ({
          key: c.key,
          clientName: c.name,
          clientId: c.clientId,
          columns: [
            { label: "CA", value: formatEuro(c.ca) },
            { label: "Heures réelles", value: `${c.hours.toFixed(1)} h` },
            { label: "€/h réel", value: `${formatEuro(c.hourlyRate)}/h` },
            { label: "Cible", value: `${formatEuro(targetHR)}/h` },
          ],
          reason: `Taux horaire réel à ${Math.round((c.hourlyRate / targetHR) * 100)} % de la cible.`,
        }));
    }

    if (topic === "opportunites") {
      const nameMap = nameByClient;
      return (priorityOffers.data ?? []).map((o, i) => ({
        key: `${o.client_id}-${i}`,
        clientName: nameMap.get(o.client_id) ?? "Client",
        clientId: o.client_id,
        columns: [
          { label: "Prestation", value: o.service_name },
          { label: "Catégorie", value: o.category_name ?? "—" },
          { label: "Score", value: `${Math.round(o.score_opportunity)}/100` },
          { label: "Valeur estimée", value: o.estimated_value ? formatEuro(o.estimated_value) : "—" },
        ],
        reason: reasonText(o.reason, o.days_since_last_performed),
      }));
    }

    // Focus basés sur CA entries — lastByClientCa
    const lastByClientCa = new Map<
      string,
      { name: string; clientId: string | null; last: number; families: Set<string>; lastByFamily: Map<string, number> }
    >();
    for (const e of allE) {
      const key = e.client_id ?? `name:${(e.client_name ?? "").toLowerCase()}`;
      if (!key) continue;
      const t = new Date(e.entry_date).getTime();
      const cur =
        lastByClientCa.get(key) ?? {
          name: e.client_name ?? "Sans nom",
          clientId: e.client_id,
          last: 0,
          families: new Set<string>(),
          lastByFamily: new Map<string, number>(),
        };
      if (t > cur.last) cur.last = t;
      cur.families.add(e.family);
      const prevF = cur.lastByFamily.get(e.family) ?? 0;
      if (t > prevF) cur.lastByFamily.set(e.family, t);
      if (e.client_name) cur.name = e.client_name;
      if (e.client_id) cur.clientId = e.client_id;
      lastByClientCa.set(key, cur);
    }
    const DAY = 86_400_000;
    const today = Date.now();

    if (topic === "dormants") {
      const cut = today - CLIENT_ACTIVITY_RULES.DORMANT_DAYS * DAY;
      return Array.from(lastByClientCa.entries())
        .filter(([, v]) => v.last < cut)
        .slice(0, 100)
        .map(([key, v]) => ({
          key,
          clientName: v.name,
          clientId: v.clientId,
          columns: [
            { label: "Dernier passage", value: new Date(v.last).toLocaleDateString("fr-FR") },
            { label: "Jours depuis", value: `${Math.floor((today - v.last) / DAY)} j` },
          ],
          reason: "Aucun CA facturé depuis plus de 12 mois.",
        }));
    }

    if (topic === "creation-sans-entretien") {
      return Array.from(lastByClientCa.entries())
        .filter(([, v]) => v.families.has("amenagement") && !v.families.has("sap"))
        .slice(0, 100)
        .map(([key, v]) => ({
          key,
          clientName: v.name,
          clientId: v.clientId,
          columns: [
            { label: "Dernier passage", value: new Date(v.last).toLocaleDateString("fr-FR") },
          ],
          reason: "Aménagement facturé, aucun entretien associé — proposer un contrat annuel.",
        }));
    }

    if (topic === "entretien-sans-conseil") {
      const cut = today - CLIENT_ACTIVITY_RULES.DORMANT_DAYS * DAY;
      return Array.from(lastByClientCa.entries())
        .filter(([, v]) => v.families.has("sap") && (v.lastByFamily.get("conseil") ?? 0) < cut)
        .slice(0, 100)
        .map(([key, v]) => ({
          key,
          clientName: v.name,
          clientId: v.clientId,
          columns: [
            { label: "Dernier entretien", value: new Date(v.lastByFamily.get("sap") ?? v.last).toLocaleDateString("fr-FR") },
          ],
          reason: "Aucune prestation de conseil depuis 12 mois — proposer un audit.",
        }));
    }

    if (topic === "depassements-temps") {
      const avg = new Map<string, { total: number; n: number }>();
      for (const i of allI) {
        if (i.status !== "terminee" || i.hours_spent == null) continue;
        const est =
          i.ai_metadata && typeof i.ai_metadata === "object" &&
          (i.ai_metadata as Record<string, unknown>).hours_estimated === true;
        if (est) continue;
        const key = i.intervention_type ?? "—";
        const cur = avg.get(key) ?? { total: 0, n: 0 };
        cur.total += Number(i.hours_spent);
        cur.n += 1;
        avg.set(key, cur);
      }
      const avgMap = new Map<string, number>();
      avg.forEach((v, k) => v.n >= 2 && avgMap.set(k, v.total / v.n));
      return allI
        .filter((i) => {
          if (i.status !== "terminee" || i.hours_spent == null) return false;
          const a = avgMap.get(i.intervention_type ?? "—");
          return a != null && Number(i.hours_spent) > a * 1.5;
        })
        .slice(0, 100)
        .map((i) => {
          const a = avgMap.get(i.intervention_type ?? "—") ?? 0;
          return {
            key: i.id,
            clientName: nameByClient.get(i.client_id) ?? "Client",
            clientId: i.client_id,
            interventionId: i.id,
            columns: [
              { label: "Date", value: new Date(i.intervention_date).toLocaleDateString("fr-FR") },
              { label: "Type", value: i.intervention_type ?? "—" },
              { label: "Heures", value: `${Number(i.hours_spent).toFixed(1)} h` },
              { label: "Moyenne type", value: `${a.toFixed(1)} h` },
            ],
            reason: `Temps réel à ${Math.round((Number(i.hours_spent) / a) * 100)} % de la moyenne du type.`,
          };
        });
    }

    if (topic === "rentabilite-faible") {
      if (targetHR <= 0) return [];
      const caByClient = new Map<string, number>();
      for (const e of allE) {
        if (!e.client_id) continue;
        if (new Date(e.entry_date).getFullYear() !== year) continue;
        caByClient.set(e.client_id, (caByClient.get(e.client_id) ?? 0) + e.amount_ht);
      }
      return allE
        .filter((e) => {
          const rh = e.client_id ? confirmedMap.get(e.client_id) ?? 0 : 0;
          if (rh > 0 && e.client_id) {
            const ca = caByClient.get(e.client_id) ?? 0;
            return ca > 0 && ca / rh < targetHR;
          }
          return e.hours > 0 && e.amount_ht / e.hours < targetHR;
        })
        .slice(0, 100)
        .map((e) => ({
          key: e.id,
          clientName: e.client_name ?? "Sans nom",
          clientId: e.client_id,
          columns: [
            { label: "Date", value: new Date(e.entry_date).toLocaleDateString("fr-FR") },
            { label: "Prestation", value: e.nature ?? "—" },
            { label: "CA", value: formatEuro(e.amount_ht) },
            { label: "Heures", value: `${e.hours.toFixed(1)} h` },
            { label: "€/h", value: e.hours > 0 ? `${formatEuro(e.amount_ht / e.hours)}/h` : "—" },
          ],
          reason: `Sous la cible ${formatEuro(targetHR)}/h.`,
        }));
    }

    return [];
  }, [topic, loading, entries.data, interventions.data, recos.data, confirmedHours.data, hoursLedger.data, priorityOffers.data, targetHR, year, mode]);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/pilot" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Retour au cockpit
        </Link>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {meta.title}
            <Badge variant="outline">{loading ? "…" : rows.length}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Rien à signaler ici.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {r.clientId ? (
                          <Link
                            to="/pilot/fiche/$clientId"
                            params={{ clientId: r.clientId }}
                            className="text-sm font-semibold text-foreground hover:underline"
                          >
                            {r.clientName}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold">{r.clientName}</span>
                        )}
                        {r.columns.map((c) => (
                          <span key={c.label} className="text-xs text-muted-foreground">
                            <span className="uppercase tracking-wide">{c.label}</span>{" "}
                            <span className="text-foreground tabular-nums">{c.value}</span>
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {r.canWaiveReport && r.interventionId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={waiveMut.isPending}
                          onClick={() => waiveMut.mutate(r.interventionId!)}
                        >
                          <BellOff className="mr-1 h-3 w-3" /> Pas de CR exceptionnellement
                        </Button>
                      )}
                      {r.interventionId && (
                        <Link to="/interventions/$interventionId" params={{ interventionId: r.interventionId }}>
                          <Button size="sm" variant="outline">Ouvrir <ArrowRight className="ml-1 h-3 w-3" /></Button>
                        </Link>
                      )}
                      {!r.interventionId && r.clientId && (
                        <Link to="/pilot/fiche/$clientId" params={{ clientId: r.clientId }}>
                          <Button size="sm" variant="outline">Fiche <ArrowRight className="ml-1 h-3 w-3" /></Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function reasonText(r: string, days: number | null): string {
  if (r === "jamais_realise") return "Prestation jamais réalisée chez ce client.";
  if (r === "hors_frequence")
    return days != null
      ? `Dernier passage il y a ${days} j — hors fréquence prévue.`
      : "En retard par rapport à la fréquence prévue.";
  if (r === "rappel_saisonnier") return "Saison optimale en cours pour cette prestation.";
  return r;
}