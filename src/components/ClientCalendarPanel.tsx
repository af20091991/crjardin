import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { CalendarDays, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { createCeevPlanningUpload, deleteCeevPlanning, finalizeCeevPlanningUpload, getCeevPlanningUrl } from "@/lib/client-portal.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/clients";

const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = "client-plannings";

export function ClientCalendarPanel({ client, canEdit }: { client: Client; canEdit: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const hasPlanning = Boolean(client.ceev_planning_path);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-calendar-url", client.id, client.ceev_planning_path],
    queryFn: () => getCeevPlanningUrl({ data: { token: client.share_token } }),
    enabled: hasPlanning,
    staleTime: 45 * 60 * 1000,
  });

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Le calendrier doit être un PDF");
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      toast.error("Le PDF ne doit pas dépasser 15 Mo");
      return;
    }
    setBusy(true);
    try {
      const target = await createCeevPlanningUpload({ data: { clientId: client.id, filename: file.name, size: file.size } });
      const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(target.path, target.token, file);
      if (uploadError) throw new Error(`Import du PDF impossible : ${uploadError.message}`);
      await finalizeCeevPlanningUpload({ data: { clientId: client.id, path: target.path, filename: file.name, size: file.size } });
      await qc.invalidateQueries({ queryKey: ["client", client.id] });
      await qc.invalidateQueries({ queryKey: ["client-calendar-url", client.id] });
      toast.success("Calendrier enregistré");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer le calendrier");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteCeevPlanning({ data: { clientId: client.id } });
      await qc.invalidateQueries({ queryKey: ["client", client.id] });
      await qc.invalidateQueries({ queryKey: ["client-calendar-url", client.id] });
      toast.success("Calendrier supprimé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer le calendrier");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Calendrier du chantier</p>
            <p className="text-xs text-muted-foreground">
              {hasPlanning
                ? `${client.ceev_planning_filename ?? "Calendrier PDF"}${client.ceev_planning_updated_at ? ` · mis à jour le ${new Date(client.ceev_planning_updated_at).toLocaleDateString("fr-FR")}` : ""}`
                : "Aucun calendrier PDF enregistré pour ce client."}
            </p>
          </div>
          {canEdit && (
            <div className="flex shrink-0 gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
                <Upload className="h-4 w-4" />
                {busy ? "Traitement…" : hasPlanning ? "Remplacer" : "Importer un PDF"}
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={upload} />
              </label>
              {hasPlanning && (
                <Button type="button" variant="outline" size="icon" disabled={busy} onClick={remove} aria-label="Supprimer le calendrier">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasPlanning ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Le calendrier PDF apparaîtra ici après import.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Ouverture du calendrier…</CardContent></Card>
      ) : error || !data?.url ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-sm text-muted-foreground">Impossible d'afficher le calendrier.</p><Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["client-calendar-url", client.id] })}>Réessayer</Button></CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-end border-b bg-muted/20 p-2">
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={data.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" /> Ouvrir dans un nouvel onglet</a>
            </Button>
          </div>
          <iframe src={data.url} title="Calendrier du chantier" className="h-[min(75vh,900px)] w-full border-0" />
        </Card>
      )}
    </div>
  );
}
