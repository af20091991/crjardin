import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { WorksiteSheetForm } from "@/components/WorksiteSheetForm";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/clients";
import {
  getWorksiteSheet, updateWorksiteSheet, deleteWorksiteSheet,
  type WorksiteSheetInput,
} from "@/lib/worksite";
import { exportWorksiteSheetPdf } from "@/lib/worksite-pdf";
import { ArrowLeft, FileDown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/fiches/$ficheId")({
  head: () => ({ meta: [{ title: "Fiche chantier — De la graine au jardin" }] }),
  component: EditFiche,
});

function EditFiche() {
  const { ficheId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canEdit, isLoading: roleLoading } = useRole();
  useEffect(() => { if (!roleLoading && !canEdit) navigate({ to: "/", replace: true }); }, [canEdit, roleLoading, navigate]);

  const { data: sheet, isLoading } = useQuery({ queryKey: ["worksite-sheet", ficheId], queryFn: () => getWorksiteSheet(ficheId), enabled: canEdit });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [exporting, setExporting] = useState(false);

  const save = useMutation({
    mutationFn: (input: WorksiteSheetInput) => updateWorksiteSheet(ficheId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worksite-sheets"] });
      qc.invalidateQueries({ queryKey: ["worksite-sheet", ficheId] });
      toast.success("Fiche enregistrée");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: () => deleteWorksiteSheet(ficheId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worksite-sheets"] });
      toast.success("Fiche supprimée");
      navigate({ to: "/fiches" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  async function exportPdf() {
    if (!sheet) return;
    setExporting(true);
    try { await exportWorksiteSheetPdf(sheet); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Échec de l'export"); }
    finally { setExporting(false); }
  }

  return (
    <AppShell title="Fiche chantier">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link to="/fiches" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={exporting || !sheet} onClick={exportPdf}>
              {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />} PDF
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm("Supprimer définitivement cette fiche ?")) remove.mutate(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading || !sheet ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <WorksiteSheetForm
            clients={clients ?? []}
            initial={{
              client_id: sheet.client_id,
              civility: sheet.civility,
              client_name: sheet.client_name,
              client_phone: sheet.client_phone,
              client_phone_backup: sheet.client_phone_backup,
              contact_person: sheet.contact_person,
              address: sheet.address,
              access_complement: sheet.access_complement,
              intervention_date: sheet.intervention_date,
              intervenant: sheet.intervenant,
              client_present: sheet.client_present,
              green_waste: sheet.green_waste,
              equipment: sheet.equipment,
              epi: sheet.epi,
              tasks: sheet.tasks,
              checklist: sheet.checklist,
              photos: sheet.photos,
              notes: sheet.notes,
              latitude: sheet.latitude,
              longitude: sheet.longitude,
              garden_markers: sheet.garden_markers,
              recycling_center: sheet.recycling_center,
            }}
            submitting={save.isPending}
            submitLabel="Enregistrer les modifications"
            onSubmit={(input) => save.mutate(input)}
          />
        )}
      </div>
    </AppShell>
  );
}