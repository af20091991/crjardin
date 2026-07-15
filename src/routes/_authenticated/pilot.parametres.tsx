import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { saveSettings, DEFAULT_SETTINGS, type PilotSettings } from "@/lib/pilot";
import { getTjmSettings, saveTjmSettings, computeTjm, type TjmSettings } from "@/lib/pilot-hours";
import { formatEuro } from "@/lib/pilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings2, Target, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — Pilot Pro" }] }),
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Settings2 className="h-6 w-6 text-primary" /> Paramètres du pilotage
        </h1>
        <p className="text-sm text-muted-foreground">
          Réglez ici toutes les valeurs de référence utilisées par les différents onglets (Direction, Taux horaire, Finance, Simulateur…).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> Objectifs & rémunération
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) || 0 })}
                  />
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Enregistrer</Button>
          </div>
        </CardContent>
      </Card>

      <TjmSettingsCard />
    </div>
  );
}

function TjmSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pilot-tjm-settings"], queryFn: getTjmSettings });
  const [draft, setDraft] = useState<TjmSettings | null>(null);

  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (input: Partial<TjmSettings>) => saveTjmSettings(input),
    onSuccess: () => {
      toast.success("Paramètres TJM enregistrés");
      qc.invalidateQueries({ queryKey: ["pilot-tjm-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isFetched && !q.data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" /> Taux journalier moyen (TJM)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Aucun paramètre TJM enregistré.</p>
          <Button size="sm" onClick={() => mut.mutate({})}>Initialiser</Button>
        </CardContent>
      </Card>
    );
  }

  if (!draft) return null;

  const set = (k: keyof TjmSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value === "" ? 0 : Number(e.target.value) } : d));

  const live = computeTjm(draft);

  const numFields: { k: keyof TjmSettings; label: string }[] = [
    { k: "heures_gestion", label: "Heures gestion / mois" },
    { k: "objectif_remuneration", label: "Objectif rému. nette / mois (€)" },
    { k: "revenus_bruts", label: "Revenus bruts an (€)" },
    { k: "charges_fixes", label: "Charges fixes / mois (€)" },
    { k: "charges_variables", label: "Charges variables / mois (€)" },
    { k: "heures_jour", label: "Heures / jour" },
  ];
  const offFields: { k: keyof TjmSettings; label: string }[] = [
    { k: "conges", label: "Congés" },
    { k: "jours_off", label: "Jours off" },
    { k: "weekend", label: "Week-ends" },
    { k: "feries", label: "Fériés" },
    { k: "meteo", label: "Météo" },
    { k: "bureau", label: "Bureau" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" /> Taux journalier moyen (TJM)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {numFields.map((f) => (
            <div key={f.k} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input type="number" value={String(draft[f.k])} onChange={set(f.k)} />
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Jours non facturables / an</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {offFields.map((f) => (
              <div key={f.k} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" value={String(draft[f.k])} onChange={set(f.k)} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-4">
          <Result label="Jours facturables" value={`${live.joursFacturables.toFixed(0)} j`} />
          <Result label="Taux journalier" value={formatEuro(live.tauxJournalier)} />
          <Result label="Taux horaire moyen" value={`${live.tauxHoraire.toFixed(0)} €/h`} />
          <Result label="TJM avec objectif" value={formatEuro(live.tjmObjectif)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mut.mutate(draft)} disabled={mut.isPending}>Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-serif text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}