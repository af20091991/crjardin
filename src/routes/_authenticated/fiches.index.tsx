import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, ChevronRight } from "lucide-react";
import { listWorksiteSheets } from "@/lib/worksite";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/fiches/")({
  head: () => ({ meta: [{ title: "Fiches chantier — De la graine au jardin" }] }),
  component: FichesIndex,
});

function FichesIndex() {
  const navigate = useNavigate();
  const { canEdit, isLoading: roleLoading } = useRole();
  useEffect(() => { if (!roleLoading && !canEdit) navigate({ to: "/", replace: true }); }, [canEdit, roleLoading, navigate]);
  const { data: sheets, isLoading } = useQuery({ queryKey: ["worksite-sheets"], queryFn: listWorksiteSheets, enabled: canEdit });

  return (
    <AppShell title="Fiches chantier">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Préparation des interventions de sous-traitance</p>
          <Link to="/fiches/new"><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Nouvelle fiche</Button></Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (sheets?.length ?? 0) === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune fiche chantier pour le moment.</p>
            <Link to="/fiches/new"><Button><Plus className="mr-1.5 h-4 w-4" /> Créer une fiche</Button></Link>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {sheets!.map((s) => {
              const name = [s.civility?.trim(), s.client_name?.trim()].filter(Boolean).join(" ") || "Sans nom";
              const date = s.intervention_date ? new Date(s.intervention_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Date non définie";
              return (
                <Link key={s.id} to="/fiches/$ficheId" params={{ ficheId: s.id }}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">{date}{s.intervenant ? ` · ${s.intervenant}` : ""}{s.tasks.length ? ` · ${s.tasks.length} tâche(s)` : ""}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}