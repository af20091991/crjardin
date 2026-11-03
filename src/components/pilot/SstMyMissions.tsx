import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/pilot/LoadingState";
import { EmptyState } from "@/components/pilot/EmptyState";
import { ClipboardList } from "lucide-react";
import { MISSION_STATUS_META, type MissionStatus } from "@/lib/subcontractors";

type MyMission = {
  id: string;
  mission_date: string;
  service_requested: string;
  status: string;
  instructions: string | null;
  category: string | null;
  hours_spent: number | null;
};

/** Vue prestataire : ses missions attribuées, sans aucun montant ni marge. */
export function SstMyMissions() {
  const q = useQuery({
    queryKey: ["sst-my-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontractor_missions")
        .select("id, mission_date, service_requested, status, instructions, category, hours_spent")
        .order("mission_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (q.isLoading) return <LoadingState label="Chargement de vos missions…" />;
  const missions = q.data ?? [];

  if (missions.length === 0) {
    return <EmptyState icon={ClipboardList} title="Aucune mission attribuée." compact />;
  }

  // Heures déclarées sur l'ensemble de l'historique de ce prestataire (la politique RLS ne renvoie que ses missions).
  const totalHours = missions.reduce((sum, m) => sum + (Number(m.hours_spent) || 0), 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {missions.length} mission{missions.length > 1 ? "s" : ""} ·{" "}
        {totalHours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h déclarées au total
      </p>
      {missions.map((m: MyMission) => {
        const meta = MISSION_STATUS_META[m.status as MissionStatus];
        return (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span>{m.service_requested}</span>
                {meta && <Badge className={meta.tone}>{meta.label}</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(m.mission_date).toLocaleDateString("fr-FR")}
                {m.category ? ` · ${m.category}` : ""}
                {m.hours_spent != null ? ` · ${Number(m.hours_spent)} h` : ""}
              </p>
            </CardHeader>
            {m.instructions && (
              <CardContent className="whitespace-pre-line text-sm">{m.instructions}</CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
