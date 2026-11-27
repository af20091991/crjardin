import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APERCU_FRAME_NAME } from "@/lib/apercu";
import { exportClientFichePdf } from "@/lib/client-fiche-pdf";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { ClientOpportunitiesWidget } from "@/components/ClientOpportunitiesWidget";
import { ClientPremiumTab } from "@/components/ClientPremiumTab";
import { ClientPilotageTabs } from "@/components/pilot/ClientPilotageTabs";
import { Route } from "@/routes/_authenticated/clients.$clientId";

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { edit } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canEdit } = useRole();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [clientViewOpen, setClientViewOpen] = useState(false);
  useEffect(() => {
    if (edit && canEdit) setEditOpen(true);
  }, [edit, canEdit]);
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const { data: interventions } = useQuery({
    queryKey: ["interventions", clientId],
    queryFn: () => listInterventionsByClient(clientId),
  });
  const { data: premiumRow } = useQuery({
    queryKey: ["client-premium", clientId],
    queryFn: () => getClientPremium(clientId),
  });
  const premiumActive = !!premiumRow?.enabled;
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
          Client introuvable.{" "}
          <Link to="/clients" className="text-primary hover:underline">
            Retour
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={client.name}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tous les clients
        </Link>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-base font-semibold text-primary sm:h-14 sm:w-14 sm:text-xl">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {client.civility && (
                    <p className="text-xs font-medium text-muted-foreground">{client.civility}</p>
                  )}
                  <h2 className="truncate font-serif text-lg font-semibold sm:text-xl">
                    {client.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-1 sm:gap-1.5">
                    {client.contract_type && (
                      <Badge variant="secondary">{client.contract_type}</Badge>
                    )}
                    {client.frequency && <Badge variant="outline">{client.frequency}</Badge>}
                    {hasStale && (
                      <Badge className="gap-1 bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> Préco. en attente +30j
                      </Badge>
                    )}
                    {(interventions ?? []).some((iv) => iv.sent_to_client_at) && (
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        CR
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        REPORT_POLICY_META[(client.report_policy ?? "a_confirmer") as ReportPolicy]
                          .badge
                      }
                      title={
                        REPORT_POLICY_META[(client.report_policy ?? "a_confirmer") as ReportPolicy]
                          .hint
                      }
                    >
                      {
                        REPORT_POLICY_META[(client.report_policy ?? "a_confirmer") as ReportPolicy]
                          .short
                      }
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {client.share_token && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Ouvrir la vue client"
                    title="Vue client (lecture seule)"
                    onClick={() => setClientViewOpen(true)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {canEdit && (
                  <ClientForm
                    client={client}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    trigger={
                      <Button variant="outline" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                )}
                {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible et supprimera aussi son historique
                          d'interventions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => del.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              {client.share_token && (
                <Dialog open={clientViewOpen} onOpenChange={setClientViewOpen}>
                  <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3 p-4">
                    <DialogHeader>
                      <DialogTitle>Vue client : {client.name}</DialogTitle>
                      <DialogDescription>
                        Lecture seule : cette visite n'est ni enregistrée, ni notifiée dans PP, et
                        le client ne la voit pas.
                      </DialogDescription>
                    </DialogHeader>
                    <iframe
                      name={APERCU_FRAME_NAME}
                      src={`/partage/${client.share_token}`}
                      title={`Vue client : ${client.name}`}
                      className="min-h-0 w-full flex-1 rounded-xl border bg-background"
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm">
              {client.address && (
                <Info icon={MapPin} text={client.address}>
                  <AddressLink address={client.address} />
                </Info>
              )}
              {client.phone && (
                <Info icon={Phone} text={client.phone}>
                  <PhoneActions phone={client.phone} />
                </Info>
              )}
              {clientEmails(client).map((e) => (
                <Info key={e} icon={Mail} text={e} />
              ))}
            </div>

            {client.notes && (
              <div className="mt-4 rounded-lg bg-accent/15 p-3 text-sm">
                <p className="mb-1 font-medium text-accent-foreground">Observations importantes</p>
                <p className="text-muted-foreground">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {!premiumActive && (
          <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Crown className="h-4 w-4 text-primary/70" />
            Espace Premium Jardin Signature: inactif
          </p>
        )}

        <ClientCompletenessCard
          client={client}
          scope="fiche"
          interventionCount={interventions?.length ?? 0}
          recoCount={recos?.length ?? 0}
          onEdit={() => setEditOpen(true)}
          onGestion={(sub) =>
            navigate({
              to: "/clients/dashboard/$clientId",
              params: { clientId },
              search: { tab: "gestion", sub },
            })
          }
          onPremium={() =>
            navigate({
              to: "/clients/dashboard/$clientId",
              params: { clientId },
              search: { tab: "premium" },
            })
          }
        />

        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="sm">
            <Link to="/clients/dashboard/$clientId" params={{ clientId }}>
              <LayoutDashboard className="mr-1.5 h-4 w-4" />
              Tableau de bord
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/clients/dashboard/$clientId"
              params={{ clientId }}
              search={{ tab: "premium" }}
            >
              <Crown className="mr-1.5 h-4 w-4" />
              {premiumActive ? "Espace Premium" : "Activer l'espace Premium"}
            </Link>
          </Button>
        </div>

        <details className="group rounded-xl border bg-card p-3.5">
          <summary className="cursor-pointer list-none text-sm font-medium">
            Outils et historique
          </summary>
          <div className="mt-4 space-y-4">
            <ShareLinkCard
              clientId={client.id}
              token={client.share_token}
              copied={copied}
              setCopied={setCopied}
            />

            <ClientChangeLog clientId={client.id} />

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                exportClientFichePdf(client).catch(() => toast.error("Échec de l'export PDF"));
              }}
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              Exporter la fiche (PDF)
            </Button>

            {client.ceev_planning_path && (
              <ClientPlanningShortcut
                clientId={client.id}
                filename={client.ceev_planning_filename}
              />
            )}
          </div>
        </details>
      </div>
    </AppShell>
  );
}

function CalendarDaysIcon() {
  return <Calendar className="mr-1.5 h-4 w-4" />;
}

function Info({
  icon: Icon,
  text,
  children,
}: {
  icon: typeof MapPin;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children ?? text}</span>
    </div>
  );
}

function ShareLinkCard({
  clientId,
  token,
  copied,
  setCopied,
}: {
  clientId: string;
  token: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const regenerate = async () => {
    if (!window.confirm("L'ancien lien ne fonctionnera plus. Créer un nouveau lien ?")) return;
    setRegenerating(true);
    try {
      await regenerateClientShareToken({ data: { clientId } });
      await qc.invalidateQueries({ queryKey: ["client"] });
      toast.success("Nouveau lien créé. Pensez à le transmettre au client.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer le lien");
    } finally {
      setRegenerating(false);
    }
  };
  const [sendingLink, setSendingLink] = useState(false);
  const emailLink = async () => {
    setSendingLink(true);
    try {
      const { results } = await sendClientAccessLink({ data: { clientId } });
      const sent = results.filter((r) => r.status === "sent").length;
      if (sent === 0) toast.error("Aucun e-mail envoyé. Vérifiez l'adresse du client.");
      else toast.success(`Lien envoyé à ${sent} adresse(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setSendingLink(false);
    }
  };
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/partage/${token}`
      : `/partage/${token}`;
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
          Partagez ce lien secret avec le client : il pourra consulter sa fiche et ses
          comptes-rendus terminés, sans compte.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            readOnly
            value={url}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label="Copier le lien"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            asChild
            aria-label="Ouvrir la vue client"
          >
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" /> Ouvrir la vue client
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          disabled={sendingLink}
          onClick={emailLink}
        >
          <Mail className="mr-1.5 h-4 w-4" /> Envoyer le lien par e-mail
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 w-full text-destructive"
          disabled={regenerating}
          onClick={regenerate}
        >
          Régénérer le lien (l'ancien sera désactivé)
        </Button>
      </CardContent>
    </Card>
  );
}

export { ClientDetail };
export default ClientDetail;
