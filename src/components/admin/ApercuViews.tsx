import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { APERCU_FRAME_NAME, APERCU_PRESTATAIRE_FRAME_NAME } from "@/lib/apercu";

interface PremiumClientOption {
  client_id: string;
  name: string;
  share_token: string;
}

async function listPremiumClientOptions(): Promise<PremiumClientOption[]> {
  const { data, error } = await supabase
    .from("client_premium")
    .select("client_id, clients(name, share_token)")
    .eq("enabled", true);
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const c = row.clients as unknown as { name: string; share_token: string | null } | null;
      return c?.share_token
        ? { client_id: row.client_id, name: c.name, share_token: c.share_token }
        : null;
    })
    .filter((x): x is PremiumClientOption => x !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Vues en lecture seule : ce que voit le prestataire ou le client. */
export function ApercuViews() {
  const [clientId, setClientId] = useState<string | null>(null);
  const clientsQuery = useQuery({
    queryKey: ["apercu-premium-clients"],
    queryFn: listPremiumClientOptions,
  });
  const clients = clientsQuery.data ?? [];
  const selected = clients.find((c) => c.client_id === clientId) ?? clients[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-primary" /> Vues en lecture seule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="client">
          <TabsList>
            <TabsTrigger value="prestataire">Vue prestataire</TabsTrigger>
            <TabsTrigger value="client">Vue client</TabsTrigger>
          </TabsList>

          <TabsContent value="prestataire" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Interface telle que la voit un prestataire. Lecture seule : aucune modification n'est
              enregistrée.
            </p>
            <iframe
              name={APERCU_PRESTATAIRE_FRAME_NAME}
              src="/"
              title="Vue prestataire"
              className="h-[75vh] w-full rounded-xl border bg-background"
            />
          </TabsContent>

          <TabsContent value="client" className="mt-4 space-y-3">
            {clientsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Chargement des clients Premium…</p>
            )}
            {!clientsQuery.isLoading && clients.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun compte Premium actif.</p>
            )}
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={selected?.client_id ?? ""} onValueChange={setClientId}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.client_id} value={c.client_id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selected && (
              <iframe
                key={selected.share_token}
                name={APERCU_FRAME_NAME}
                src={`/partage/${selected.share_token}`}
                title={`Vue client : ${selected.name}`}
                className="h-[75vh] w-full rounded-xl border bg-background"
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
