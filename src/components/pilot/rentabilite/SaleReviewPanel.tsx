// Lignes de vente à examiner (rentabilité clients) : résolution directe sur la ligne.
// Chaque action passe par le moteur existant (rattachement journalisé, désignation, ignorer).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAttachmentCertification } from "@/components/pilot/useAttachmentCertification";
import { listClients } from "@/lib/clients";
import { linkEntryToClient, ignoreEntry } from "@/lib/pilot-ca-matching";
import { updateCaEntry } from "@/lib/pilot-ca";
import { VERDICT_META, type SaleVerdict } from "@/lib/pilot-attachment-certification";
import { formatEuro } from "@/lib/pilot";
import { toast } from "sonner";

export function SaleReviewPanel() {
  const { report, refetch } = useAttachmentCertification();
  const [showAll, setShowAll] = useState(false);
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const pending = useMemo(
    () => (report?.sales ?? []).filter((s) => VERDICT_META[s.verdict].status !== "certifie"),
    [report],
  );
  if (pending.length === 0) return null;
  const visible = showAll ? pending : pending.slice(0, 15);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-medium">Lignes à examiner</h3>
          <Badge variant="outline">{pending.length}</Badge>
        </div>
        <div className="space-y-2">
          {visible.map((s) => (
            <SaleRow
              key={s.saleId}
              sale={s}
              clients={clientsQ.data ?? []}
              onChanged={() => refetch()}
            />
          ))}
        </div>
        {pending.length > 15 && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Réduire" : `Voir les ${pending.length} lignes`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SaleRow({
  sale,
  clients,
  onChanged,
}: {
  sale: SaleVerdict;
  clients: Array<{ id: string; name: string }>;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [designation, setDesignation] = useState(sale.designation ?? "");
  const [busy, setBusy] = useState(false);

  const done = (message: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ["certif-sales"] });
    queryClient.invalidateQueries({ queryKey: ["certif-clients"] });
    queryClient.invalidateQueries({ queryKey: ["pilot-entries"] });
    onChanged();
  };
  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      done(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const meta = VERDICT_META[sale.verdict];
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {meta.label}
        </Badge>
        <span className="font-medium">{sale.clientName ?? "Client absent"}</span>
        <span className="ml-auto text-muted-foreground">{formatEuro(sale.amountHt)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{sale.detail}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="Désignation"
          className="h-8 w-64"
          aria-label="Désignation de la ligne"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || designation.trim() === (sale.designation ?? "")}
          onClick={() =>
            run(
              () => updateCaEntry(sale.saleId, { designation: designation.trim() || null }),
              "Désignation enregistrée",
            )
          }
        >
          Enregistrer la désignation
        </Button>
        <Select
          disabled={busy}
          onValueChange={(clientId) =>
            run(
              () => linkEntryToClient({ entryId: sale.saleId, clientId, method: "manual" }),
              "Ligne rattachée",
            )
          }
        >
          <SelectTrigger className="h-8 w-56" aria-label="Rattacher à une fiche">
            <SelectValue placeholder="Rattacher à une fiche…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(() => ignoreEntry({ entryId: sale.saleId }), "Ligne ignorée des analyses clients")
          }
        >
          Ignorer la ligne
        </Button>
      </div>
    </div>
  );
}
