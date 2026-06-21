import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { getClient, deleteClient } from "@/lib/clients";
import { listInterventionsByClient } from "@/lib/interventions";
import {
  listRecommendationsByClient, listHealthByClient,
  RECO_STATUS_META, type RecommendationStatus,
  HEALTH_RATING_META, type HealthRating,
  recommendationPrice, formatEuro, isStalePending, clearRecommendationInterest,
} from "@/lib/garden";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Pencil, Trash2, MapPin, Phone, Mail, FileText, Calendar,
  Sparkles, ClipboardList, Leaf, AlertTriangle, Share2, Copy, Check, ExternalLink,
  ThumbsUp, ThumbsDown, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canEdit } = useRole();
  const [copied, setCopied] = useState(false);
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const { data: interventions } = useQuery({
    queryKey: ["interventions", clientId],
    queryFn: () => listInterventionsByClient(clientId),
  });
  const { data: recos } = useQuery({
    queryKey: ["recommendations", clientId],
    queryFn: () => listRecommendationsByClient(clientId),
  });
  const hasStale = (recos ?? []).some(isStalePending);
  const { data: health } = useQuery({
    queryKey: ["health", clientId],
    queryFn: () => listHealthByClient(clientId),
  });

  const del = useMutation({
    mutationFn: () => deleteClient(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client supprimé");
      navigate({ to: "/clients" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  if (isLoading) {
    return (
      <AppShell title="Client">
        <div className="mx-auto max-w-3xl space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell title="Client">
        <div className="mx-auto max-w-3xl text-center text-muted-foreground">
          Client introuvable. <Link to="/clients" className="text-primary hover:underline">Retour</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={client.name}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tous les clients
        </Link>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-xl font-semibold text-primary">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {client.civility && <p className="text-xs font-medium text-muted-foreground">{client.civility}</p>}
                  <h2 className="truncate font-serif text-xl font-semibold">{client.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {client.contract_type && <Badge variant="secondary">{client.contract_type}</Badge>}
                    {client.frequency && <Badge variant="outline">{client.frequency}</Badge>}
                    {hasStale && (
                      <Badge className="gap-1 bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> Préco. en attente +30j
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
              <div className="flex shrink-0 gap-1.5">
                <ClientForm client={client} trigger={<Button variant="outline" size="icon"><Pencil className="h-4 w-4" /></Button>} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible et supprimera aussi son historique d'interventions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </div>

            <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {client.address && <Info icon={MapPin} text={client.address} />}
              {client.phone && <Info icon={Phone} text={client.phone} />}
              {client.email && <Info icon={Mail} text={client.email} />}
            </div>

            {client.notes && (
              <div className="mt-4 rounded-lg bg-accent/15 p-3 text-sm">
                <p className="mb-1 font-medium text-accent-foreground">Observations importantes</p>
                <p className="text-muted-foreground">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <ShareLinkCard token={client.share_token} copied={copied} setCopied={setCopied} />

        <Tabs defaultValue="interventions">
          <TabsList className="w-full">
            <TabsTrigger value="interventions" className="flex-1"><Calendar className="mr-1.5 h-4 w-4" />Interventions</TabsTrigger>
            <TabsTrigger value="health" className="flex-1"><Leaf className="mr-1.5 h-4 w-4" />Santé</TabsTrigger>
            <TabsTrigger value="reco" className="flex-1"><Sparkles className="mr-1.5 h-4 w-4" />Préconisations</TabsTrigger>
          </TabsList>
          <TabsContent value="interventions">
            {(interventions?.length ?? 0) === 0 ? (
              <HistoryPlaceholder label="Aucune intervention pour le moment." icon={ClipboardList} action clientId={clientId} />
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
                  <Link key={iv.id} to="/interventions/$interventionId" params={{ interventionId: iv.id }}>
                    <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-primary/40">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{iv.title ?? iv.intervention_type ?? "Intervention"}</p>
                        <p className="flex gap-1 truncate text-xs text-muted-foreground">
                          {iv.reference && <span className="font-mono">{iv.reference} ·</span>}
                          {new Date(iv.intervention_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <Badge variant={iv.status === "termine" ? "default" : "secondary"} className="shrink-0">
                        {iv.status === "termine" ? "Terminé" : "Brouillon"}
                      </Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="health">
            {(health?.length ?? 0) === 0 ? (
              <HistoryPlaceholder label="Aucune évaluation enregistrée." icon={Leaf} />
            ) : (
              <div className="mt-3 space-y-2.5">
                {health!.map((h) => {
                  const rating = (h.rating as HealthRating) in HEALTH_RATING_META ? (h.rating as HealthRating) : "bon";
                  return (
                    <Card key={h.id} className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_RATING_META[rating].dot}`} />
                        <p className="font-medium">{h.zone}</p>
                        <Badge className={HEALTH_RATING_META[rating].tone}>{HEALTH_RATING_META[rating].label}</Badge>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(h.assessed_on).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
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
              <HistoryPlaceholder label="Aucune préconisation enregistrée." icon={Sparkles} />
            ) : (
              <div className="mt-3 space-y-2.5">
                {recos!.map((r) => {
                  const status = (r.status as RecommendationStatus) in RECO_STATUS_META ? (r.status as RecommendationStatus) : "en_attente";
                  return (
                    <Card key={r.id} className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{r.title}</p>
                          {r.category && <Badge variant="secondary" className="mt-1">{r.category}</Badge>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={RECO_STATUS_META[status].tone}>{RECO_STATUS_META[status].label}</Badge>
                          {recommendationPrice(r) != null && (
                            <span className="text-xs font-semibold text-primary">{formatEuro(recommendationPrice(r)!)}</span>
                          )}
                        </div>
                      </div>
                      {r.description && <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>}
                      <RecoInterest reco={r} onCleared={() => qc.invalidateQueries({ queryKey: ["recommendations", clientId] })} />
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Info({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function ShareLinkCard({ token, copied, setCopied }: { token: string; copied: boolean; setCopied: (v: boolean) => void }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/partage/${token}` : `/partage/${token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Share2 className="h-4 w-4 text-primary" /> Lien de visualisation client
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Partagez ce lien secret avec le client : il pourra consulter sa fiche et ses comptes-rendus terminés, sans compte.
        </p>
        <div className="mt-3 flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copier le lien">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="outline" size="icon" asChild aria-label="Ouvrir la vue client">
            <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
          </Button>
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" /> Ouvrir la vue client
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function RecoInterest({ reco, onCleared }: { reco: { id: string; client_interest: string | null }; onCleared: () => void }) {
  const m = useMutation({
    mutationFn: () => clearRecommendationInterest(reco.id),
    onSuccess: () => { toast.success("Réaction du client réinitialisée"); onCleared(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  if (!reco.client_interest) return null;
  const interested = reco.client_interest === "interested";
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-2">
      <span className="flex items-center gap-1.5 text-sm">
        {interested ? <ThumbsUp className="h-4 w-4 text-primary" /> : <ThumbsDown className="h-4 w-4 text-muted-foreground" />}
        {interested ? "Client intéressé" : "Client non intéressé"}
      </span>
      <Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate()}>
        <RotateCcw className="mr-1.5 h-4 w-4" /> Réinitialiser
      </Button>
    </div>
  );
}

function HistoryPlaceholder({ label, icon: Icon, action, clientId }: { label: string; icon: typeof FileText; action?: boolean; clientId?: string }) {
  return (
    <Card className="mt-3 border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{label}</p>
        {action && (
          <Link to="/interventions/new" search={clientId ? { client: clientId } : undefined} className="mt-1 text-sm font-medium text-primary hover:underline">
            Créer un compte-rendu
          </Link>
        )}
      </CardContent>
    </Card>
  );
}