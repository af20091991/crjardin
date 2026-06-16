import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { getClient, deleteClient } from "@/lib/clients";
import { listInterventionsByClient } from "@/lib/interventions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Pencil, Trash2, MapPin, Phone, Mail, FileText, Calendar,
  Image as ImageIcon, Sparkles, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const { data: interventions } = useQuery({
    queryKey: ["interventions", clientId],
    queryFn: () => listInterventionsByClient(clientId),
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
                  <h2 className="truncate font-serif text-xl font-semibold">{client.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {client.contract_type && <Badge variant="secondary">{client.contract_type}</Badge>}
                    {client.frequency && <Badge variant="outline">{client.frequency}</Badge>}
                  </div>
                </div>
              </div>
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

        <Tabs defaultValue="interventions">
          <TabsList className="w-full">
            <TabsTrigger value="interventions" className="flex-1"><Calendar className="mr-1.5 h-4 w-4" />Interventions</TabsTrigger>
            <TabsTrigger value="reports" className="flex-1"><FileText className="mr-1.5 h-4 w-4" />Rapports</TabsTrigger>
            <TabsTrigger value="photos" className="flex-1"><ImageIcon className="mr-1.5 h-4 w-4" />Photos</TabsTrigger>
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
                        <p className="truncate font-medium">{iv.intervention_type ?? "Intervention"}</p>
                        <p className="text-xs text-muted-foreground">
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
          <TabsContent value="reports"><HistoryPlaceholder label="Aucun rapport PDF généré." icon={FileText} /></TabsContent>
          <TabsContent value="photos"><HistoryPlaceholder label="Aucune photo enregistrée." icon={ImageIcon} /></TabsContent>
          <TabsContent value="reco"><HistoryPlaceholder label="Aucune préconisation enregistrée." icon={Sparkles} /></TabsContent>
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