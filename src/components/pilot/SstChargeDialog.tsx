import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientPicker } from "@/components/pilot/ClientPicker";
import type { SstMode } from "@/lib/sst-charges";

/**
 * Fenêtre ouverte au moment où une charge reçoit la catégorie « SST » : elle demande
 * le mode (autonome ou chantier auquel vous participez) et le client rattaché.
 */
export function SstChargeDialog({
  open,
  onOpenChange,
  designation,
  clients,
  initialClientId,
  initialMode,
  remaining,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designation: string | null;
  clients: Array<{ id: string; name: string }>;
  initialClientId: string | null;
  initialMode: SstMode | null;
  /** Nombre de charges SST encore à classer (affiché si > 1). */
  remaining?: number;
  onConfirm: (value: { sst_mode: SstMode; client_id: string }) => void;
}) {
  const [mode, setMode] = useState<SstMode | null>(initialMode);
  const [clientId, setClientId] = useState<string>(initialClientId ?? "");

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setClientId(initialClientId ?? "");
    }
  }, [open, initialMode, initialClientId]);

  const choice = (value: SstMode, label: string, hint: string) => {
    const active = mode === value;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setMode(value)}
        className={`flex-1 rounded-md border p-3 text-left text-sm transition-colors ${
          active ? "border-primary bg-primary/10" : "border-input hover:bg-muted/40"
        }`}
      >
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Charge de sous-traitance</DialogTitle>
          <DialogDescription className="truncate">
            {designation || "Charge SST"}
            {remaining && remaining > 1 ? ` · ${remaining} charges SST à classer` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <p className="font-medium">SST en autonomie ?</p>
            <div className="flex gap-2">
              {choice("autonome", "Oui", "Le prestataire réalise seul la mission")}
              {choice("accompagnee", "Non", "Vous participez au chantier")}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-medium">Client rattaché</p>
            <ClientPicker clients={clients} value={clientId} onChange={setClientId} />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!mode || !clientId}
            onClick={() => mode && clientId && onConfirm({ sst_mode: mode, client_id: clientId })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
