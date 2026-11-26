import { Link, useNavigate } from "@tanstack/react-router";
import { ClientCompletenessCard } from "@/components/clients/ClientCompletenessCard";
import { recoResponseState, RECO_RESPONSE_TONE } from "@/lib/reco-response";
import { AddressLink, PhoneActions } from "@/components/ContactActions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientCalendarPanel } from "@/components/ClientCalendarPanel";
import {
  getClient,
  deleteClient,
  clientEmails,
  REPORT_POLICY_META,
  type ReportPolicy,
} from "@/lib/clients";
import { listInterventionsByClient } from "@/lib/interventions";
import {
  listRecommendationsByClient,
  listHealthByClient,
  RECO_STATUS_META,
  type RecommendationStatus,
  HEALTH_RATING_META,
  type HealthRating,
  recommendationPrice,
  formatEuro,
  isStalePending,
  clearRecommendationInterest,
  markRecommendationAsProposed,
  acceptRecommendation,
  refuseRecommendation,
  createInterventionFromRecommendation,
  type Recommendation,
} from "@/lib/garden";
import { Button } from "@/components/ui/button";
import { getClientPremium } from "@/lib/client-premium";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientPlanningShortcut } from "@/components/ClientPlanningShortcut";
import { regenerateClientShareToken } from "@/lib/share-link.functions";
import { ClientChangeLog } from "@/components/ClientChangeLog";
import { sendClientAccessLink } from "@/lib/premium-email.functions";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  Sparkles,
  ClipboardList,
  Leaf,
  AlertTriangle,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Compass,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  TrendingUp,
  Send,
  ArrowRight,
  Sprout,
  Crown,
  FileDown,
  LayoutDashboard,
} from "lucide-react";
import { exportClientFichePdf } from "@/lib/client-fiche-pdf";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { ClientOpportunitiesWidget } from "@/components/ClientOpportunitiesWidget";
import { ClientPremiumTab } from "@/components/ClientPremiumTab";
import { ClientPilotageTabs } from "@/components/pilot/ClientPilotageTabs";
import { Route } from "@/routes/_authenticated/clients.$clientId";

type Client = NonNullable<Awaited<ReturnType<typeof getClient>>>;

/** Rubriques de gestion d'un client (interventions, calendrier, santé, préconisations, opportunités). */
export function ClientGestionTabs({
  clientId,
  client,
  interventions,
  health,
  recos,
  canEdit,
  tab,
  onTabChange,
}: {
  clientId: string;
  client: Client;
  interventions: Awaited<ReturnType<typeof listInterventionsByClient>> | undefined;
  health: Awaited<ReturnType<typeof listHealthByClient>> | undefined;
  recos: Awaited<ReturnType<typeof listRecommendationsByClient>> | undefined;
  canEdit: boolean;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const qc = useQueryClient();
  const gestionTab = tab;
  const setGestionTab = onTabChange;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (interventions ?? [])
    .filter((iv) => iv.intervention_date >= today && iv.status !== "annulee")
    .sort((a, b) => a.intervention_date.localeCompare(b.intervention_date));
  return (
    <>
      <Tabs value={gestionTab} onValueChange={setGestionTab}>
        <Select value={gestionTab} onValueChange={setGestionTab}>
          <SelectTrigger className="w-full" aria-label="Rubrique de gestion">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interventions">Interventions</SelectItem>
            <SelectItem value="calendar">Calendrier</SelectItem>
            <SelectItem value="health">Santé</SelectItem>
            <SelectItem value="reco">Préconisations</SelectItem>
            <SelectItem value="opps">Opportunités</SelectItem>
          </SelectContent>
        </Select>
        <TabsContent value="interventions">
          {upcoming.length > 0 && (
            <Card className="mt-3 flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span className="text-muted-foreground">Prochaine intervention</span>
              <span className="font-medium">
                {upcoming[0].title ?? upcoming[0].intervention_type ?? "Intervention"} ·{" "}
                {new Date(`${upcoming[0].intervention_date}T12:00:00`).toLocaleDateString("fr-FR")}
              </span>
            </Card>
          )}
          {(interventions?.length ?? 0) === 0 ? (
            <HistoryPlaceholder
              label="Aucune intervention pour le moment."
              icon={ClipboardList}
              action
              clientId={clientId}
            />
          ) : (
            <div className="mt-3 space-y-2.5">
              <Link
                to="/interventions/new"
                search={{ client: clientId }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 py-2.5 text-sm font-medium text-primary hover:bg-primary/5"
              >
                <Calendar className="h-4 w-4" /> Nouveau compte-rendu
              </Link>
              {interventions!.map((iv) => (
                <Link
                  key={iv.id}
                  to="/interventions/$interventionId"
                  params={{ interventionId: iv.id }}
                >
                  <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-primary/40">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {iv.title ?? iv.intervention_type ?? "Intervention"}
                      </p>
                      <p className="flex gap-1 truncate text-xs text-muted-foreground">
                        {iv.reference && <span className="font-mono">{iv.reference} ·</span>}
                        {new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <Badge variant={iv.status === "terminee" ? "default" : "secondary"}>
                        {iv.status === "terminee" ? "Terminé" : "Brouillon"}
                      </Badge>
                      {iv.sent_to_client_at && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Envoyé au client
                        </Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="calendar">
          <ClientCalendarPanel client={client} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="health">
          {(health?.length ?? 0) === 0 ? (
            <HistoryPlaceholder
              label="Aucune évaluation enregistrée."
              hint="Les évaluations se saisissent dans un compte-rendu d'intervention."
              icon={Leaf}
              action
              clientId={clientId}
            />
          ) : (
            <div className="mt-3 space-y-2.5">
              {health!.map((h) => {
                const rating =
                  (h.rating as HealthRating) in HEALTH_RATING_META
                    ? (h.rating as HealthRating)
                    : "bon";
                return (
                  <Card key={h.id} className="p-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${HEALTH_RATING_META[rating].dot}`}
                      />
                      <p className="font-medium">{h.zone}</p>
                      <Badge className={HEALTH_RATING_META[rating].tone}>
                        {HEALTH_RATING_META[rating].label}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(h.assessed_on).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {h.note && <p className="mt-1.5 text-sm text-muted-foreground">{h.note}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="reco">
          {(recos?.length ?? 0) === 0 ? (
            <HistoryPlaceholder
              label="Aucune préconisation enregistrée."
              hint="Les préconisations se rédigent dans un compte-rendu d'intervention."
              icon={Sparkles}
              action
              clientId={clientId}
            />
          ) : (
            <div className="mt-3 space-y-2.5">
              {recos!.map((r) => (
                <RecoCard
                  key={r.id}
                  reco={r}
                  clientId={clientId}
                  canEdit={canEdit}
                  onChanged={() => {
                    qc.invalidateQueries({ queryKey: ["recommendations", clientId] });
                    qc.invalidateQueries({ queryKey: ["recommendations-all"] });
                    qc.invalidateQueries({ queryKey: ["recommendations-funnel"] });
                    qc.invalidateQueries({ queryKey: ["opportunities-value"] });
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="opps">
          <ClientOpportunitiesWidget clientId={clientId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function RecoInterest({
  reco,
  onCleared,
}: {
  reco: { id: string; client_interest: string | null };
  onCleared: () => void;
}) {
  const m = useMutation({
    mutationFn: () => clearRecommendationInterest(reco.id),
    onSuccess: () => {
      toast.success("Réaction du client réinitialisée");
      onCleared();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  if (!reco.client_interest) return null;
  const interested = reco.client_interest === "interested";
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-2">
      <span className="flex items-center gap-1.5 text-sm">
        {interested ? (
          <ThumbsUp className="h-4 w-4 text-primary" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-muted-foreground" />
        )}
        {interested ? "Client intéressé" : "Client non intéressé"}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={m.isPending}
        onClick={() => m.mutate()}
      >
        <RotateCcw className="mr-1.5 h-4 w-4" /> Réinitialiser
      </Button>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  manuel: "Saisie manuelle",
  next_best_offer: "Next Best Offer",
  cr_intervention: "Compte-rendu",
  intervention: "Compte-rendu",
};

function RecoCard({
  reco,
  clientId,
  canEdit,
  onChanged,
}: {
  reco: Recommendation;
  clientId: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const status =
    (reco.status as RecommendationStatus) in RECO_STATUS_META
      ? (reco.status as RecommendationStatus)
      : "en_attente";
  const price = recommendationPrice(reco);
  const sourceLabel = SOURCE_LABELS[reco.source] ?? reco.source;

  const propose = useMutation({
    mutationFn: () => markRecommendationAsProposed(reco.id),
    onSuccess: () => {
      toast.success("Recommandation proposée");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const accept = useMutation({
    mutationFn: () => acceptRecommendation(reco.id),
    onSuccess: () => {
      toast.success("Recommandation acceptée");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const refuse = useMutation({
    mutationFn: () => refuseRecommendation(reco.id),
    onSuccess: () => {
      toast.success("Recommandation refusée");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const createInt = useMutation({
    mutationFn: () => createInterventionFromRecommendation(reco.id),
    onSuccess: (interventionId) => {
      toast.success("Intervention créée");
      onChanged();
      navigate({ to: "/interventions/$interventionId", params: { interventionId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{reco.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            {reco.category && <Badge variant="secondary">{reco.category}</Badge>}
            <Badge variant="outline">{sourceLabel}</Badge>
            {!(reco.include_in_report && reco.status !== "refusee") && (
              <Badge variant="outline" className="text-muted-foreground">
                Masquée au client
              </Badge>
            )}
            {reco.recommended_season && (
              <Badge variant="outline" className="gap-1">
                <Sprout className="h-3 w-3" /> {reco.recommended_season}
              </Badge>
            )}
            <span className="text-muted-foreground">
              {new Date(reco.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={RECO_STATUS_META[status].tone}>{RECO_STATUS_META[status].label}</Badge>
          {price != null && (
            <span className="text-xs font-semibold text-primary">{formatEuro(price)}</span>
          )}
        </div>
      </div>
      {reco.description && (
        <p className="mt-1.5 text-sm text-muted-foreground">{reco.description}</p>
      )}
      {(() => {
        const state = recoResponseState(reco);
        return (
          <p className={`mt-2 text-xs font-medium ${RECO_RESPONSE_TONE[state.tone]}`}>
            {state.label}
          </p>
        );
      })()}
      <RecoInterest reco={reco} onCleared={onChanged} />

      {canEdit && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {status === "en_attente" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={propose.isPending}
              onClick={() => propose.mutate()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Marquer comme proposée
            </Button>
          )}
          {status === "proposee" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={refuse.isPending}
                onClick={() => refuse.mutate()}
              >
                <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Marquer refusée
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Marquer acceptée
              </Button>
            </>
          )}
          {status === "acceptee" && (
            <Button size="sm" disabled={createInt.isPending} onClick={() => createInt.mutate()}>
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Créer intervention
            </Button>
          )}
        </div>
      )}
      <span className="hidden" data-client={clientId} />
    </Card>
  );
}

function HistoryPlaceholder({
  label,
  hint,
  icon: Icon,
  action,
  clientId,
}: {
  label: string;
  hint?: string;
  icon: typeof FileText;
  action?: boolean;
  clientId?: string;
}) {
  return (
    <Card className="mt-3 border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{label}</p>
        {hint && <p className="max-w-xs text-xs text-muted-foreground/80">{hint}</p>}
        {action && (
          <Link
            to="/interventions/new"
            search={clientId ? { client: clientId } : undefined}
            className="mt-1 text-sm font-medium text-primary hover:underline"
          >
            Créer un compte-rendu
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
