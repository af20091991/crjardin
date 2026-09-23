import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { WorksiteSheetForm } from "@/components/WorksiteSheetForm";
import { listClients } from "@/lib/clients";
import { listSubcontractors } from "@/lib/subcontractors";
import { createWorksiteSheet, emptyWorksiteSheet, setWorksiteSheetSubcontractors } from "@/lib/worksite";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/fiches/new")({
  head: () => ({ meta: [{ title: "Nouvelle fiche SST — De la graine au jardin" }] }),
  component: NewFiche,
});

function NewFiche() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canEdit, isLoading: roleLoading } = useRole();
  useEffect(() => { if (!roleLoading && !canEdit) navigate({ to: "/", replace: true }); }, [canEdit, roleLoading, navigate]);
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: subcontractors } = useQuery({ queryKey: ["subcontractors"], queryFn: listSubcontractors });

  const create = useMutation({
    mutationFn: async ({ input, sstIds }: { input: Parameters<typeof createWorksiteSheet>[0]; sstIds: string[] }) => {
      const sheet = await createWorksiteSheet(input);
      try {
        await setWorksiteSheetSubcontractors(sheet.id, sstIds);
      } catch (error) {
        try {
          const { deleteWorksiteSheet } = await import("@/lib/worksite");
          await deleteWorksiteSheet(sheet.id);
        } catch {
          // Preserve the original error; cleanup is best-effort.
        }
        throw error;
      }
      return sheet;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["worksite-sheets"] });
      toast.success("Fiche chantier créée");
      navigate({ to: "/fiches/$ficheId", params: { ficheId: s.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <AppShell title="Nouvelle fiche SST">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/fiches" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <WorksiteSheetForm
          clients={clients ?? []}
          subcontractors={subcontractors ?? []}
          initial={emptyWorksiteSheet()}
          submitting={create.isPending}
          submitLabel="Créer la fiche"
          onSubmit={(input, sstIds) => create.mutate({ input, sstIds })}
        />
      </div>
    </AppShell>
  );
}