// Règles de rapprochement apprises : consultation et suppression (Chantier 2).
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { listClients } from "@/lib/clients";
import { deleteMatchRule, listMatchRules } from "@/lib/pilot-match-rules";

export function MatchRulesPanel() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["pilot-match-rules"], queryFn: listMatchRules });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const nameById = useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c.name])),
    [clients.data],
  );

  const del = useMutation({
    mutationFn: (id: string) => deleteMatchRule(id),
    onSuccess: () => {
      toast.success("Règle supprimée");
      qc.invalidateQueries({ queryKey: ["pilot-match-rules"] });
      qc.invalidateQueries({ queryKey: ["pilot-match-memory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = rules.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookMarked className="h-4 w-4 text-primary" />
          Règles apprises
          <Badge variant="outline" className="ml-auto text-[10px]">{list.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          « Cette désignation correspond toujours à ce client. » Chaque règle vient d'une validation
          humaine ; elle guide les suggestions suivantes et peut être supprimée à tout moment.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Aucune règle enregistrée pour le moment : validez un rapprochement pour en créer une.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {r.sample_designation || r.designation_key}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    → {nameById.get(r.client_id) ?? "client archivé"} · {r.hits} utilisation(s) ·
                    {" "}mise à jour le {new Date(r.updated_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={del.isPending}
                  onClick={() => del.mutate(r.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
