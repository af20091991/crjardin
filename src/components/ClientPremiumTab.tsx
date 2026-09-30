import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Crown,
  CalendarDays,
  Upload,
  Trash2,
  Download,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  getClientPremium,
  setClientPremiumEnabled,
  updateClientPremium,
  listPremiumDocuments,
  uploadPremiumDocument,
  updatePremiumDocumentVisibility,
  deletePremiumDocument,
  signedPremiumDocumentUrl,
  listClientPhotosForCover,
  listPremiumWorkCalendar,
  replacePremiumWorkCalendar,
  type PremiumDocument,
} from "@/lib/client-premium";
import { signedPhotoUrl } from "@/lib/interventions";
import { parsePlanning } from "@/lib/file-parser";
import { normalizePremiumWorkCalendar } from "@/lib/premium-work-calendar.functions";

export function ClientPremiumTab({
  clientId,
  canEdit,
}: {
  clientId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();

  const { data: premium, isLoading } = useQuery({
    queryKey: ["client-premium", clientId],
    queryFn: () => getClientPremium(clientId),
  });
  const { data: documents } = useQuery({
    queryKey: ["client-premium-documents", clientId],
    queryFn: () => listPremiumDocuments(clientId),
  });
  const { data: workCalendar } = useQuery({
    queryKey: ["client-premium-work-calendar", clientId],
    queryFn: () => listPremiumWorkCalendar(clientId),
  });

  const [gardenState, setGardenState] = useState("");
  const [gardenObjectives, setGardenObjectives] = useState("");
  const [gardenSpecificities, setGardenSpecificities] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [commercialNote, setCommercialNote] = useState("");
  const [initialized, setInitialized] = useState(false);
  if (premium && !initialized) {
    setGardenState(premium.garden_state ?? "");
    setGardenObjectives(premium.garden_objectives ?? "");
    setGardenSpecificities(premium.garden_specificities ?? "");
    setGoogleReviewUrl(premium.google_review_url ?? "");
    setCommercialNote(premium.commercial_note ?? "");
    setInitialized(true);
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-premium", clientId] });

  const importExistingPlanning = async () => {
    const existingPlanning = (documents ?? []).find(
      (doc) =>
        doc.title.toLowerCase() === "calendrier travaux" ||
        /calendrier|planning/.test(doc.filename.toLowerCase()),
    );
    if (existingPlanning && (workCalendar?.length ?? 0) > 0) return true;

    const { data: files, error } = await supabase.storage
      .from("client-plannings")
      .list(clientId, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
    if (error) throw new Error(`Impossible de rechercher le calendrier client : ${error.message}`);

    const source = (files ?? []).find((file) => /.pdf$/i.test(file.name));
    if (!source) return false;

    const { data: signed, error: signError } = await supabase.storage
      .from("client-plannings")
      .createSignedUrl(`${clientId}/${source.name}`, 60 * 60);
    if (signError || !signed?.signedUrl) {
      throw new Error("Impossible d'accéder au PDF du calendrier client.");
    }

    const response = await fetch(signed.signedUrl);
    if (!response.ok) throw new Error("Impossible de télécharger le PDF du calendrier client.");
    const blob = await response.blob();
    const file = new File([blob], source.name, { type: "application/pdf" });
    const rows = await parsePlanning(file);
    if (rows.length === 0) {
      throw new Error("Le PDF du calendrier client ne contient aucune intervention exploitable.");
    }

    const normalized = await normalizePremiumWorkCalendar({
      data: {
        rows: rows.map((row) => ({
          period_label: row.label || row.monthLabel,
          year: row.year,
          month: row.month,
          sequence: Number((row.label.match(/(\d+)\s*$/)?.[1] ?? row.index + 1)),
          type: row.type,
          tasks: row.tasks,
        })),
      },
    });
    const document = await uploadPremiumDocument(clientId, file, "Calendrier travaux");
    await replacePremiumWorkCalendar(clientId, document.id, normalized.items);
    return true;
  };

  const toggleEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      await setClientPremiumEnabled(clientId, enabled);
      if (enabled) {
        return await importExistingPlanning();
      }
      return null;
    },
    onSuccess: (calendarImported, enabled) => {
      if (enabled) {
        toast.success(
          calendarImported
            ? "Espace Premium activé avec le calendrier travaux."
            : "Espace Premium activé. Importez le PDF du calendrier travaux pour compléter l'espace client.",
        );
        qc.invalidateQueries({ queryKey: ["client-premium-documents", clientId] });
        qc.invalidateQueries({ queryKey: ["client-premium-work-calendar", clientId] });
      } else {
        toast.success("Espace Premium désactivé");
      }
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const saveFields = useMutation({
    mutationFn: () =>
      updateClientPremium(clientId, {
        garden_state: gardenState || null,
        garden_objectives: gardenObjectives || null,
        garden_specificities: gardenSpecificities || null,
        google_review_url: googleReviewUrl || null,
        commercial_note: commercialNote || null,
      }),
    onSuccess: () => {
      toast.success("Enregistré");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  if (isLoading) {
    return (
      <Card className="mt-3">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Espace Premium</p>
              <p className="text-xs text-muted-foreground">
                Active un espace enrichi pour ce client (état du jardin, documents, messagerie).
              </p>
            </div>
          </div>
          <Switch
            checked={premium?.enabled ?? false}
            disabled={!canEdit || toggleEnabled.isPending}
            onCheckedChange={(v) => toggleEnabled.mutate(v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div>
            <Label htmlFor="garden-state">État du jardin</Label>
            <Textarea
              id="garden-state"
              value={gardenState}
              disabled={!canEdit}
              onChange={(e) => setGardenState(e.target.value)}
              placeholder="Ex : jardin en bon état général, taille des rosiers prévue en mars…"
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="garden-objectives">Objectifs du jardin</Label>
            <Textarea
              id="garden-objectives"
              value={gardenObjectives}
              disabled={!canEdit}
              onChange={(e) => setGardenObjectives(e.target.value)}
              placeholder="Ex : préserver les plantes existantes, réduire l’arrosage, garder une floraison étalée…"
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="garden-specificities">Particularités du jardin</Label>
            <Textarea
              id="garden-specificities"
              value={gardenSpecificities}
              disabled={!canEdit}
              onChange={(e) => setGardenSpecificities(e.target.value)}
              placeholder="Ex : sol très calcaire, zone ventée, présence d’un chien, contraintes d’accès…"
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="commercial-note">Note commerciale (visible du client)</Label>
            <Textarea
              id="commercial-note"
              value={commercialNote}
              disabled={!canEdit}
              onChange={(e) => setCommercialNote(e.target.value)}
              placeholder="Message libre affiché dans l'espace client"
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="google-review">Lien avis Google</Label>
            <Input
              id="google-review"
              value={googleReviewUrl}
              disabled={!canEdit}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/..."
              className="mt-1.5"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit || saveFields.isPending}
            onClick={() => saveFields.mutate()}
          >
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <CoverPhotoPicker
        clientId={clientId}
        canEdit={canEdit}
        currentPhotoId={premium?.cover_photo_id ?? null}
        onSelected={invalidate}
      />

      <PremiumWorkCalendarCard
        clientId={clientId}
        documents={documents ?? []}
        workCalendar={workCalendar ?? []}
        canEdit={canEdit}
        onUpdated={() => {
          qc.invalidateQueries({ queryKey: ["client-premium-documents", clientId] });
          qc.invalidateQueries({ queryKey: ["client-premium-work-calendar", clientId] });
        }}
      />
      <PremiumDocumentsCard clientId={clientId} documents={documents ?? []} canEdit={canEdit} />
    </div>
  );
}

function CoverPhotoPicker({
  clientId,
  currentPhotoId,
  canEdit,
  onSelected,
}: {
  clientId: string;
  currentPhotoId: string | null;
  canEdit: boolean;
  onSelected: () => void;
}) {
  const { data: photos } = useQuery({
    queryKey: ["client-premium-cover-options", clientId],
    queryFn: () => listClientPhotosForCover(clientId),
  });
  const { data: urls } = useQuery({
    queryKey: ["client-premium-cover-urls", clientId, photos?.map((p) => p.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        (photos ?? []).map(async (p) => [p.id, await signedPhotoUrl(p.storage_path)] as const),
      );
      return Object.fromEntries(entries);
    },
    enabled: (photos?.length ?? 0) > 0,
  });

  const select = useMutation({
    mutationFn: (photoId: string) => updateClientPremium(clientId, { cover_photo_id: photoId }),
    onSuccess: () => {
      toast.success("Photo de couverture mise à jour");
      onSelected();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium">Photo de couverture</p>
        </div>
        {(photos?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune photo d'intervention disponible pour ce client.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {photos!.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select.mutate(p.id)}
                disabled={!canEdit || select.isPending}
                className={`aspect-square overflow-hidden rounded-lg border-2 ${
                  currentPhotoId === p.id ? "border-primary" : "border-transparent"
                }`}
              >
                {urls?.[p.id] ? (
                  <img src={urls[p.id]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" />
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PremiumWorkCalendarCard({
  clientId,
  documents,
  workCalendar,
  canEdit,
  onUpdated,
}: {
  clientId: string;
  documents: PremiumDocument[];
  workCalendar: Awaited<ReturnType<typeof listPremiumWorkCalendar>>;
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const planningDocument = documents.find(
    (doc) =>
      doc.title.toLowerCase() === "calendrier travaux" ||
      /calendrier|planning/.test(doc.filename.toLowerCase()),
  );

  const importCalendar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      toast.error("Le calendrier travaux doit être fourni au format PDF.");
      return;
    }
    setBusy(true);
    try {
      const rows = await parsePlanning(file);
      if (rows.length === 0) throw new Error("Aucune intervention exploitable n'a été trouvée dans ce PDF.");
    const normalized = await normalizePremiumWorkCalendar({
        data: {
          rows: rows.map((row) => ({
            period_label: row.label || row.monthLabel,
            year: row.year,
            month: row.month,
            sequence: Number((row.label.match(/(\d+)\s*$/)?.[1] ?? row.index + 1)),
            type: row.type,
            tasks: row.tasks,
          })),
        },
      });
      const document = await uploadPremiumDocument(clientId, file, "Calendrier travaux");
      await replacePremiumWorkCalendar(clientId, document.id, normalized.items);
      toast.success("Calendrier travaux importé et adapté pour le Compte Premium.");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'importer le calendrier.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={planningDocument && workCalendar.length > 0 ? "" : "border-primary/40 bg-primary/5"}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Calendrier travaux</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Le PDF source est conservé dans Documents et son contenu est repris dans l'onglet « Calendrier travaux » du Compte Premium.
            </p>
          </div>
        </div>

        {planningDocument ? (
          <div className="rounded-lg border bg-background p-3 text-sm">
            <p className="font-medium truncate">{planningDocument.filename}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {workCalendar.length} passage{workCalendar.length > 1 ? "s" : ""} structuré{workCalendar.length > 1 ? "s" : ""}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-background p-5">
            <p className="font-medium">Le calendrier travaux n'est pas encore associé.</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Importez le PDF du calendrier d'entretien à la création du Compte Premium. Il sera automatiquement ajouté aux Documents et transformé en liste de prochaines interventions.
            </p>
          </div>
        )}

        <Button type="button" variant={planningDocument ? "outline" : "default"} disabled={!canEdit || busy} asChild>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            {busy ? "Analyse du calendrier…" : planningDocument ? "Remplacer le calendrier PDF" : "Importer le calendrier PDF"}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={importCalendar} disabled={!canEdit || busy} />
          </label>
        </Button>
      </CardContent>
    </Card>
  );
}

const UPLOADER_LABEL: Record<PremiumDocument["uploaded_by"], string> = {
  gardener: "Vous",
  client: "Client",
};

function PremiumDocumentsCard({
  clientId,
  documents,
  canEdit,
}: {
  clientId: string;
  documents: PremiumDocument[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["client-premium-documents", clientId] });

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await uploadPremiumDocument(clientId, file, title || file.name);
      setTitle("");
      invalidate();
      toast.success("Document ajouté");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  const toggleVisibility = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      updatePremiumDocumentVisibility(id, visible),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string }) =>
      deletePremiumDocument(id, storagePath),
    onSuccess: () => {
      toast.success("Document supprimé");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const download = async (doc: PremiumDocument) => {
    try {
      const url = await signedPremiumDocumentUrl(doc.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Document indisponible");
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="mb-3 font-medium">Documents</p>
        <div className="mb-3 flex gap-2">
          <Input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du document"
          />
          <Button type="button" variant="outline" disabled={!canEdit || busy} asChild>
            <label className="cursor-pointer">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input type="file" className="hidden" onChange={upload} disabled={!canEdit || busy} />
            </label>
          </Button>
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <User className="h-3 w-3" /> {UPLOADER_LABEL[doc.uploaded_by]}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={doc.visible_to_client ? "Masquer au client" : "Rendre visible"}
                    disabled={!canEdit || toggleVisibility.isPending}
                    onClick={() =>
                      toggleVisibility.mutate({ id: doc.id, visible: !doc.visible_to_client })
                    }
                  >
                    {doc.visible_to_client ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Télécharger"
                    onClick={() => download(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    aria-label="Supprimer"
                    disabled={!canEdit || remove.isPending}
                    onClick={() => remove.mutate({ id: doc.id, storagePath: doc.storage_path })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
