import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getClient } from "@/lib/clients";
import { getClientEconomicScore, SCORE_META } from "@/lib/client-score";
import { listNextBestOffers, explainOffer, reasonLabel, formatSeason } from "@/lib/next-best-offers";
import { formatEuro } from "@/lib/pilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, MapPin, Phone, Mail, TrendingUp, Clock, Activity, Sparkles,
  Target, FileText, Compass, ShieldCheck, AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/fiche/$clientId")({
  head: () => ({ meta: [{ title: "Fiche client 360° — Pilot Pro" }] }),
  component: PilotClient360,
});

const CONFIDENCE_META: Record<"HIGH" | "MEDIUM" | "LOW", { label: string; color: string; icon: typeof ShieldCheck }> = {
  HIGH: { label: "Fiabilité élevée", color: "#4F8E33", icon: ShieldCheck },
  MEDIUM: { label: "Fiabilité moyenne", color: "#EE8627", icon: Activity },
  LOW: { label: "Fiabilité faible", color: "#8896A0", icon: AlertCircle },
};

interface InterventionRow {
  id: string;
  intervention_date: string;
  intervention_type: string | null;
  status: string;
  title: string | null;
  hours_spent: number | null;
  sent_to_client_at: string | null;
  pdf_storage_path: string | null;
  intervention_tasks: { id: string; label: string; status: string }[];
}

function PilotClient360() {
  const { clientId } = Route.useParams();

  const clientQ = useQuery({
    queryKey: ["fiche-client", clientId],
    queryFn: () => getClient(clientId),
  });

  const scoreQ = useQuery({
    queryKey: ["fiche-score", clientId],
    queryFn: () => getClientEconomicScore(clientId),
  });

  const interventionsQ = useQuery({
    queryKey: ["fiche-interventions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interventions")
        .select("id,intervention_date,intervention_type,status,title,hours_spent,sent_to_client_at,pdf_storage_path,intervention_tasks(id,label,status)")
        .eq("client_id", clientId)
        .order("intervention_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as InterventionRow[];
    },
  });

  const offersQ = useQuery({
    queryKey: ["fiche-nbo", clientId],
    queryFn: () => listNextBestOffers(clientId),
  });

  const recosQ = useQuery({
    queryKey: ["fiche-recos", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recommendations")
        .select("id,title,description,category,status,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (clientQ.isLoading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }
  if (clientQ.isError || !clientQ.data) {
    return (
      <div className="space-y-3">
        <BackLink />
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Client introuvable.</CardContent></Card>
      </div>
    );
  }

  const client = clientQ.data;
  const score = scoreQ.data ?? null;
  const noEconomicData = !scoreQ.isLoading && score === null;
  const scoreMeta = score ? SCORE_META[score.score] : null;
  const confMeta = score ? CONFIDENCE_META[score.confidenceLevel] : null;
  const ConfIcon = confMeta?.icon;

  const topOffer = (offersQ.data ?? [])[0] ?? null;
  const nextAction = buildNextAction(score, topOffer);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <Link to="/clients/$clientId" params={{ clientId: client.id }}>
          <Button variant="outline" size="sm">Fiche CRM complète</Button>
        </Link>
      </div>

      {/* En-tête */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold">{client.name}</h1>
                {scoreMeta && (
                  <Badge variant="outline" className="gap-1" style={{ borderColor: scoreMeta.color, color: scoreMeta.color }}>
                    <span>{scoreMeta.emoji}</span>{scoreMeta.label}
                  </Badge>
                )}
                {confMeta && ConfIcon && (
                  <Badge variant="outline" className="gap-1" style={{ borderColor: confMeta.color, color: confMeta.color }}>
                    <ConfIcon className="h-3 w-3" />{confMeta.label}
                  </Badge>
                )}
                {client.contract_type && <Badge variant="secondary">{client.contract_type}</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {client.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{client.address}</span>}
                {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                {client.frequency && <span>Fréquence : {client.frequency}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {noEconomicData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <p className="font-medium">Aucune donnée économique disponible</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Ce client n'a pas encore de chiffre d'affaires, d'intervention ou d'opportunité enregistrés.
              Le score et les indicateurs s'afficheront dès la première saisie.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action recommandée */}
      {nextAction && !noEconomicData && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <Compass className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-primary">Action recommandée</div>
              <p className="mt-1 text-sm font-medium">{nextAction.title}</p>
              {nextAction.detail && <p className="mt-0.5 text-sm text-muted-foreground">{nextAction.detail}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Synthèse économique */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MiniStat icon={TrendingUp} label="CA historique" value={formatEuro(score?.revenueTotalHt ?? 0)} />
        <MiniStat icon={TrendingUp} label="CA année en cours" value={formatEuro(score?.revenueYearHt ?? 0)} />
        <MiniStat icon={Activity} label="Interventions" value={String(score?.interventionsCount ?? 0)} />
        <MiniStat icon={Clock} label="Heures confirmées" value={`${(score?.hoursConfirmed ?? 0).toFixed(1)} h`} />
        <MiniStat
          icon={Clock}
          label="Taux horaire réel"
          value={score?.realHourlyRate != null ? `${formatEuro(score.realHourlyRate)}/h` : "—"}
          sub={score?.targetHourlyRate ? `Cible ${formatEuro(score.targetHourlyRate)}/h` : undefined}
        />
        <MiniStat icon={Sparkles} label="Potentiel commercial" value={formatEuro(score?.opportunitiesValue ?? 0)} sub={`${score?.opportunitiesCount ?? 0} offre(s)`} />
      </div>

      {score?.recommendation && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />Recommandation économique</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{score.recommendation}</p></CardContent>
        </Card>
      )}

      {/* Historique */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Historique des interventions</CardTitle></CardHeader>
        <CardContent>
          {interventionsQ.isLoading ? <Skeleton className="h-24" /> : (interventionsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune intervention enregistrée.</p>
          ) : (
            <ul className="space-y-2">
              {(interventionsQ.data ?? []).map((iv) => {
                const cr = crStatus(iv);
                return (
                  <li key={iv.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{new Date(iv.intervention_date).toLocaleDateString("fr-FR")}</span>
                        <Badge variant="outline">{iv.intervention_type ?? "Entretien"}</Badge>
                        {iv.hours_spent != null && (
                          <span className="text-xs text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" />{iv.hours_spent.toFixed(1)} h</span>
                        )}
                        <Badge variant="outline" className="gap-1" style={{ borderColor: cr.color, color: cr.color }}>{cr.label}</Badge>
                      </div>
                      <Link to="/interventions/$interventionId" params={{ interventionId: iv.id }} className="text-xs text-primary hover:underline">Ouvrir →</Link>
                    </div>
                    {iv.title && <p className="mt-1 text-sm text-muted-foreground">{iv.title}</p>}
                    {iv.intervention_tasks && iv.intervention_tasks.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {iv.intervention_tasks.slice(0, 8).map((t) => (
                          <span key={t.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t.label}</span>
                        ))}
                        {iv.intervention_tasks.length > 8 && (
                          <span className="text-[11px] text-muted-foreground">+{iv.intervention_tasks.length - 8}</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Opportunités commerciales */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Opportunités commerciales</CardTitle></CardHeader>
        <CardContent>
          {offersQ.isLoading ? <Skeleton className="h-20" /> : (offersQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune opportunité détectée pour ce client.</p>
          ) : (
            <ul className="space-y-2">
              {(offersQ.data ?? []).map((o) => (
                <li key={`${o.client_id}-${o.service_id}`} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{o.service_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reasonLabel(o.reason)}</Badge>
                      <Badge variant="outline">Score {Math.round(o.score_opportunity)}/100</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{explainOffer(o)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {o.category_name && <span>{o.category_name}</span>}
                    <span>Saison : {formatSeason(o.recommended_season)}</span>
                    {(o.estimated_value ?? 0) > 0 && <span>Valeur estimée : {formatEuro(o.estimated_value ?? 0)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recommandations */}
      {(recosQ.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />Recommandations en cours</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(recosQ.data ?? []).map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    <Badge variant="secondary">{r.status ?? "en attente"}</Badge>
                  </div>
                  {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/pilot/direction" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />Retour au dashboard Direction
    </Link>
  );
}

function MiniStat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className="mt-1.5 font-serif text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function crStatus(iv: InterventionRow): { label: string; color: string } {
  if (iv.sent_to_client_at) return { label: "CR envoyé", color: "#4F8E33" };
  if (iv.pdf_storage_path) return { label: "CR archivé", color: "#EE8627" };
  if (iv.status === "termine") return { label: "Terminée", color: "#8896A0" };
  return { label: "Brouillon", color: "#8896A0" };
}

function buildNextAction(
  score: Awaited<ReturnType<typeof getClientEconomicScore>> | null,
  topOffer: Awaited<ReturnType<typeof listNextBestOffers>>[number] | null,
): { title: string; detail?: string } | null {
  if (!score) return null;
  if (score.score === "peu_rentable") {
    return {
      title: "Réévaluer la relation commerciale",
      detail: score.recommendation,
    };
  }
  if (score.score === "donnees_insuffisantes") {
    return {
      title: "Confirmer les heures des dernières interventions",
      detail: "Le taux horaire réel ne peut pas être calculé tant que les heures ne sont pas validées.",
    };
  }
  if (topOffer) {
    return {
      title: `Proposer : ${topOffer.service_name}`,
      detail: `${reasonLabel(topOffer.reason)} · score ${Math.round(topOffer.score_opportunity)}/100 — ${explainOffer(topOffer)}`,
    };
  }
  return {
    title: "Maintenir la relation",
    detail: score.recommendation,
  };
}