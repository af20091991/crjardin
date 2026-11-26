import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/components/premium-admin/shared";

// Table absente des types générés (migration 20261117160000)
type ChangeRow = { id: string; changed_at: string; changes: Record<string, unknown> };
type LooseDb = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        c: string,
        v: string,
      ) => {
        order: (
          c: string,
          o: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{ data: ChangeRow[] | null; error: unknown }>;
        };
      };
    };
  };
};

const LABELS: Record<string, string> = {
  name: "Nom",
  civility: "Civilité",
  email: "E-mail",
  emails: "Adresses e-mail",
  phone: "Téléphone",
  address: "Adresse",
  contract_type: "Type de contrat",
  client_type: "Type de client",
  frequency: "Fréquence",
  notes: "Notes",
  lifecycle_status: "Statut",
  report_policy: "Politique des CR",
  lien_client: "Lien client",
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function ClientChangeLog({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-change-log", clientId],
    queryFn: async () => {
      const db = supabase as unknown as LooseDb;
      const { data, error } = await db
        .from("client_change_log")
        .select("id, changed_at, changes")
        .eq("client_id", clientId)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-primary" /> Historique des modifications
        </div>
        {isLoading && <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Aucune modification enregistrée.</p>
        )}
        <ul className="mt-3 space-y-3">
          {(data ?? []).map((row) => (
            <li key={row.id} className="border-l-2 border-primary/30 pl-3 text-sm">
              <p className="text-xs text-muted-foreground">{fmtDateTime(row.changed_at)}</p>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(row.changes).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">{LABELS[key] ?? key}</span> :{" "}
                    {typeof value === "object" && value !== null && "avant" in value ? (
                      <>
                        <span className="text-muted-foreground line-through">
                          {show((value as unknown as { avant: unknown }).avant)}
                        </span>{" "}
                        → {show((value as unknown as { après: unknown }).après)}
                      </>
                    ) : (
                      show(value)
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
