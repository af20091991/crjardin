import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { getClient } from "@/lib/clients";
import {
  deletePlanningItem,
  getClientPremium,
  listPremiumDocuments,
  listPremiumPhotos,
  listPremiumPlanning,
  setClientPremiumEnabled,
  setPremiumDocumentVisibility,
  signedPremiumDocumentUrl,
  updateClientPremium,
  updatePlanningItem,
  uploadPremiumDocument,
} from "@/lib/client-premium";
import { AppShell } from "@/components/AppShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/clients/$clientId/premium")({
  component: ClientPremiumPage,
});

function ClientPremiumPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [review, setReview] = useState("");
  const [note, setNote] = useState("");

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const premiumQ = useQuery({
    queryKey: ["client-premium", clientId],
    queryFn: () => getClientPremium(clientId),
  });
  const docsQ = useQuery({
    queryKey: ["premium-documents", clientId],
    queryFn: () => listPremiumDocuments(clientId),
    enabled: !!premiumQ.data,
  });
  const planQ = useQuery({
    queryKey: ["premium-planning", clientId],
    queryFn: () => listPremiumPlanning(clientId),
    enabled: !!premiumQ.data,
  });
  const photosQ = useQuery({
    queryKey: ["premium-photos", clientId],
    queryFn: () => listPremiumPhotos(clientId),
    enabled: !!premiumQ.data,
  });

  useEffect(() => {
    const premium = premiumQ.data;
    if (!premium) return;
    setReview((value) => value || premium.google_review_url || "");
    setNote((value) => value || premium.commercial_note || "");
  }, [premiumQ.data]);

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      setClientPremiumEnabled(clientId, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-premium", clientId] });
      qc.invalidateQueries({ queryKey: ["premium-client-ids"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erreur"),
  });

  if (clientQ.isLoading) {
    return (
      <AppShell title="Client Premium">
        <div className="p-6">Chargement…</div>
      </AppShell>
    );
  }

  const client = clientQ.data;
  if (!client) return null;

  const premium = premiumQ.data;

  return (
    <AppShell title={`Premium — ${client.name}`}>
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la fiche
        </Link>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold">
                  Espace Client Premium
                </h1>
                <Badge variant={premium?.enabled ? "default" : "secondary"}>
                  {premium?.enabled ? "Actif" : "Inactif"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Espace séparé des données métier. Désactiver Premium ne supprime rien.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Activer</span>
              <Switch
                checked={!!premium?.enabled}
                onCheckedChange={(value) => toggle.mutate(value)}
                disabled={toggle.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {premium?.enabled && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Espace commercial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={review}
                    onChange={(event) => setReview(event.target.value)}
                    placeholder="Lien d'avis Google"
                  />
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Note commerciale / message au client"
                  />
                  <Button
                    onClick={async () => {
                      try {
                        await updateClientPremium(clientId, {
                          google_review_url: review || null,
                          commercial_note: note || null,
                        });
                        toast.success("Enregistré");
                        qc.invalidateQueries({
                          queryKey: ["client-premium", clientId],
                        });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Erreur",
                        );
                      }
                    }}
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Enregistrer
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Titre du document"
                  />
                  <input
                    type="file"
                    id="premium-doc"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;

                      try {
                        await uploadPremiumDocument(
                          clientId,
                          file,
                          "document",
                          title || file.name,
                          null,
                        );
                        toast.success("Document ajouté");
                        setTitle("");
                        qc.invalidateQueries({
                          queryKey: ["premium-documents", clientId],
                        });
                        event.currentTarget.value = "";
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Erreur",
                        );
                      }
                    }}
                  />
                  <label
                    htmlFor="premium-doc"
                    className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    Ajouter un document
                  </label>

                  <div className="space-y-2">
                    {(docsQ.data ?? []).map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate">
                          {document.title}
                        </span>
                        <Badge variant="outline">
                          {document.visible_to_client ? "Visible" : "Interne"}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={
                            document.visible_to_client
                              ? "Masquer au client"
                              : "Rendre visible au client"
                          }
                          onClick={async () => {
                            try {
                              await setPremiumDocumentVisibility(
                                document.id,
                                !document.visible_to_client,
                              );
                              await qc.invalidateQueries({
                                queryKey: ["premium-documents", clientId],
                              });
                              toast.success(
                                document.visible_to_client
                                  ? "Document masqué"
                                  : "Document visible",
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Erreur",
                              );
                            }
                          }}
                        >
                          {document.visible_to_client ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              window.open(
                                await signedPremiumDocumentUrl(
                                  document.storage_path,
                                ),
                                "_blank",
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Document indisponible",
                              );
                            }
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Couverture photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(photosQ.data ?? []).slice(0, 12).map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={async () => {
                        try {
                          await updateClientPremium(clientId, {
                            cover_photo_id: photo.id,
                          });
                          await qc.invalidateQueries({
                            queryKey: ["client-premium", clientId],
                          });
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Erreur",
                          );
                        }
                      }}
                      className={
                        premium.cover_photo_id === photo.id
                          ? "overflow-hidden rounded-lg border-2 border-primary"
                          : "overflow-hidden rounded-lg border"
                      }
                    >
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={photo.caption ?? "Photo d’intervention"}
                          className="h-24 w-full object-cover"
                        />
                      ) : (
                        <div className="h-24 bg-muted" />
                      )}
                      <span className="block truncate p-1 text-left text-[11px]">
                        {photo.intervention_title ?? photo.intervention_date}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sans choix manuel, la couverture retenue est la photo de l’intervention la
                  plus récente.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Calendrier des travaux
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  id="premium-plan"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    try {
                      const result = await uploadPremiumDocument(
                        clientId,
                        file,
                        "planning",
                        file.name,
                        new Date().getFullYear(),
                      );
                      toast.success(
                        result.extractedCount > 0
                          ? `PDF importé : ${result.extractedCount} élément(s) à valider`
                          : "PDF importé, mais aucune proposition exploitable n’a été détectée",
                      );
                      qc.invalidateQueries({
                        queryKey: ["premium-documents", clientId],
                      });
                      qc.invalidateQueries({
                        queryKey: ["premium-planning", clientId],
                      });
                      event.currentTarget.value = "";
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Erreur",
                      );
                    }
                  }}
                />
                <label
                  htmlFor="premium-plan"
                  className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"
                >
                  <CalendarDays className="mr-1.5 h-4 w-4" />
                  Importer le calendrier PDF
                </label>

                <div className="space-y-2">
                  {(planQ.data ?? []).map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          defaultValue={item.label}
                          onBlur={async (event) => {
                            if (event.target.value === item.label) return;

                            try {
                              await updatePlanningItem(item.id, {
                                label: event.target.value,
                              });
                              await qc.invalidateQueries({
                                queryKey: ["premium-planning", clientId],
                              });
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Erreur",
                              );
                            }
                          }}
                        />
                        <Badge
                          variant={
                            item.status === "valide" ? "default" : "secondary"
                          }
                        >
                          {item.status === "valide" ? "Validé" : "À valider"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await updatePlanningItem(item.id, {
                                status: "valide",
                              });
                              await qc.invalidateQueries({
                                queryKey: ["premium-planning", clientId],
                              });
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Erreur",
                              );
                            }
                          }}
                          disabled={item.status === "valide"}
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await deletePlanningItem(item.id);
                              await qc.invalidateQueries({
                                queryKey: ["premium-planning", clientId],
                              });
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Erreur",
                              );
                            }
                          }}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
