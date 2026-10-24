import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const ACQUISITION_OPTIONS = [
  "Recherche Google",
  "Site web",
  "Bouche-à-oreille",
  "Réseaux sociaux",
  "Chantier voisin / panneau",
  "Ancien client",
  "Autre",
] as const;

/** « Comment nous avez-vous connus ? » — saisie manuelle, enregistrée immédiatement. */
export function ClientAcquisitionField({
  clientId,
  initial,
}: {
  clientId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  const change = async (next: string) => {
    const previous = value;
    setValue(next);
    setBusy(true);
    const { error } = await supabase
      .from("clients")
      .update({ acquisition_source: next })
      .eq("id", clientId);
    setBusy(false);
    if (error) {
      setValue(previous);
      toast.error("Enregistrement impossible");
    } else {
      toast.success("Origine du client enregistrée");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Comment nous avez-vous connus ?</Label>
      <Select value={value} onValueChange={(v) => void change(v)} disabled={busy}>
        <SelectTrigger>
          <SelectValue placeholder="Non renseigné" />
        </SelectTrigger>
        <SelectContent>
          {ACQUISITION_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
