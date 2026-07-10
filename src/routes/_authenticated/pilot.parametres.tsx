import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { saveSettings, DEFAULT_SETTINGS, type PilotSettings } from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/parametres")({
  component: ParamsPage,
});

function ParamsPage() {
  const qc = useQueryClient();
  const { settings } = usePilotData();
  const [form, setForm] = useState<Omit<PilotSettings, "user_id">>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (settings.data) {
      const { user_id, ...rest } = settings.data;
      setForm(rest);
    }
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () => saveSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pilot-settings"] }); toast.success("Paramètres enregistrés"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields: { key: keyof typeof form; label: string; suffix: string }[] = [
    { key: "target_tjm", label: "TJM cible", suffix: "€ / jour" },
    { key: "target_hourly_rate", label: "Taux horaire cible", suffix: "€ / h" },
    { key: "monthly_salary", label: "Salaire mensuel souhaité", suffix: "€" },
    { key: "weekly_hours", label: "Heures travaillées / semaine", suffix: "h" },
    { key: "monthly_fixed_charges", label: "Charges fixes mensuelles", suffix: "€" },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h3 className="font-serif text-lg font-semibold">Paramètres de pilotage</h3>
      <Card><CardContent className="space-y-4 pt-6">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <div className="flex items-center gap-2">
              <Input type="number" inputMode="decimal" value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) || 0 })} />
              <span className="whitespace-nowrap text-sm text-muted-foreground">{f.suffix}</span>
            </div>
          </div>
        ))}
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Enregistrer</Button>
      </CardContent></Card>
    </div>
  );
}