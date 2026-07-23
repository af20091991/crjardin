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
import { Settings2, Target, CalendarClock, FileSpreadsheet, Upload, Link2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listOrphanEntries } from "@/lib/pilot-ca-matching";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/pilot/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — Pilot Pro" }] }),
  component: ParamsPage,
});

function ParamsPage() {
  const qc = useQueryClient();
  const { settings } = usePilotData();
  const orphans = useQuery({ queryKey: ["pilot-ca-orphans"], queryFn: listOrphanEntries });
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
            <Link2 className="h-4 w-4 text-primary" /> Rapprochement CA ↔ Clients
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-sm text-muted-foreground">
            {orphans.isLoading
              ? "Analyse des lignes CA en cours…"
              : `${orphans.data?.length ?? 0} ligne(s) de chiffre d'affaires ne sont pas encore rattachées à un client.`}
          </p>
          <Link
            to="/pilot/rapprochement"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ouvrir l'outil
          </Link>
        </CardContent>
      </Card>

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
      <ExcelImportCard />
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

// ---------- Import Excel ----------
type ImportRow = {
  year: number;
  month: number;
  kind: "vente" | "charge" | "remuneration";
  designation: string | null;
  category: string | null;
  amount_ht: number;
  hours: number | null;
};

function normalizeKind(v: unknown): ImportRow["kind"] | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (["vente", "ventes", "v", "ca"].includes(s)) return "vente";
  if (["charge", "charges", "c"].includes(s)) return "charge";
  if (["remuneration", "rémunération", "remu", "salaire", "r"].includes(s)) return "remuneration";
  return null;
}

function pickCol(row: Record<string, unknown>, names: string[]): unknown {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (names.some((n) => norm === n || norm.startsWith(n))) return row[k];
  }
  return undefined;
}

function parseSheet(rows: Record<string, unknown>[], defaultYear: number): ImportRow[] {
  const out: ImportRow[] = [];
  for (const r of rows) {
    const kind = normalizeKind(pickCol(r, ["type", "kind", "nature"]));
    if (!kind) continue;
    const monthRaw = pickCol(r, ["mois", "month"]);
    const month = Number(monthRaw);
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;
    const yearRaw = pickCol(r, ["année", "annee", "year"]);
    const year = Number(yearRaw) || defaultYear;
    const amount = Number(pickCol(r, ["montant ht", "montant", "amount", "ht"])) || 0;
    const hours = pickCol(r, ["heures", "hours", "h"]);
    out.push({
      year, month, kind,
      designation: (pickCol(r, ["désignation", "designation", "libellé", "libelle", "client"]) as string) ?? null,
      category: (pickCol(r, ["catégorie", "categorie", "category", "cat"]) as string) ?? null,
      amount_ht: amount,
      hours: hours == null || hours === "" ? null : Number(hours),
    });
  }
  return out;
}

function ExcelImportCard() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  async function handleFile(f: File) {
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows: ImportRow[] = [];
      for (const name of wb.SheetNames) {
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
        rows.push(...parseSheet(json, year));
      }
      if (rows.length === 0) {
        toast.error("Aucune ligne détectée. Attendu : Année, Mois, Type, Désignation, Catégorie, Montant HT, Heures.");
      } else {
        setPreview(rows);
        toast.success(`${rows.length} ligne(s) prêtes à importer`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Non authentifié");
      const years = Array.from(new Set(preview.map((r) => r.year)));
      // Remplace les données des années présentes dans le fichier
      for (const y of years) {
        const { error } = await supabase.from("pilot_ca_entries").delete().eq("year", y);
        if (error) throw error;
      }
      const payload = preview.map((r, i) => ({ ...r, user_id, position: i, is_fixed: false }));
      // Insert par lots de 200 pour rester sous les limites
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await supabase.from("pilot_ca_entries").insert(chunk as never);
        if (error) throw error;
      }
      toast.success(`${preview.length} ligne(s) importées`);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4 text-primary" /> Import Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Importez le fichier Excel de pilotage pour rafraîchir les données. Colonnes attendues :{" "}
          <code className="rounded bg-muted px-1 text-xs">Année, Mois, Type, Désignation, Catégorie, Montant HT, Heures</code>.
          <br />Type = <em>vente</em>, <em>charge</em> ou <em>remuneration</em>. Les données de chaque année présente
          dans le fichier remplacent celles déjà en base.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Année par défaut</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} className="w-28" />
          </div>
          <Input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="max-w-sm"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            disabled={busy}
          />
        </div>
        {preview && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">Aperçu : {preview.length} lignes détectées</p>
            <ul className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
              {["vente", "charge", "remuneration"].map((k) => {
                const rows = preview.filter((r) => r.kind === k);
                const total = rows.reduce((s, r) => s + r.amount_ht, 0);
                return <li key={k}>{k} : {rows.length} lignes — {formatEuro(total)}</li>;
              })}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Annuler</Button>
              <Button size="sm" onClick={commit} disabled={busy}>
                <Upload className="mr-1.5 h-4 w-4" /> Importer et remplacer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}