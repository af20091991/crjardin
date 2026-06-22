import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, ChevronDown, ChevronUp, Loader2, Plus, X, ImagePlus, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/lib/clients";
import {
  type WorksiteSheetInput,
  INTERVENANTS, EQUIPMENT_GROUPS, EPI_OPTIONS, TASK_GROUPS, CHECKLIST_OPTIONS,
  uploadWorksitePhoto, worksitePhotoUrl,
} from "@/lib/worksite";

function Toggle({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={value === true ? "default" : "outline"} onClick={() => onChange(true)}>OUI</Button>
        <Button type="button" variant={value === false ? "default" : "outline"} onClick={() => onChange(false)}>NON</Button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

function PhotoThumb({ path, onRemove }: { path: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { worksitePhotoUrl(path).then(setUrl).catch(() => {}); }, [path]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-muted" />}
      <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function WorksiteSheetForm({
  clients,
  initial,
  submitting,
  submitLabel,
  onSubmit,
}: {
  clients: Client[];
  initial: WorksiteSheetInput;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (input: WorksiteSheetInput) => void;
}) {
  const [form, setForm] = useState<WorksiteSheetInput>(initial);
  const [customTask, setCustomTask] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof WorksiteSheetInput>(k: K, v: WorksiteSheetInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleIn = (k: "equipment" | "epi" | "tasks", value: string) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(value) ? f[k].filter((x) => x !== value) : [...f[k], value],
    }));

  const toggleChecklist = (value: string) =>
    setForm((f) => ({
      ...f,
      checklist: f.checklist.includes(value) ? f.checklist.filter((x) => x !== value) : [...f.checklist, value],
    }));

  const sortedClients = useMemo(
    () => clients.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  function selectClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) { set("client_id", null); return; }
    setForm((f) => ({
      ...f,
      client_id: c.id,
      client_name: c.name ?? f.client_name,
      civility: c.civility ?? f.civility,
      address: c.address ?? f.address,
      client_phone: c.phone ?? f.client_phone,
    }));
  }

  function moveTask(i: number, dir: -1 | 1) {
    setForm((f) => {
      const next = [...f.tasks];
      const j = i + dir;
      if (j < 0 || j >= next.length) return f;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...f, tasks: next };
    });
  }

  function addCustomTask() {
    const v = customTask.trim();
    if (v && !form.tasks.includes(v)) set("tasks", [...form.tasks, v]);
    setCustomTask("");
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        paths.push(await uploadWorksitePhoto(file));
      }
      set("photos", [...form.photos, ...paths]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi des photos");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    if (!form.client_name.trim()) { toast.error("Le nom du client est requis"); return; }
    onSubmit(form);
  }

  return (
    <div className="space-y-4">
      {/* Informations client */}
      <Card>
        <CardHeader><CardTitle className="font-serif">Informations client</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client enregistré (optionnel)</Label>
            <Select value={form.client_id ?? ""} onValueChange={selectClient}>
              <SelectTrigger><SelectValue placeholder="Relier à un client existant…" /></SelectTrigger>
              <SelectContent>
                {sortedClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Civilité</Label>
              <Input value={form.civility ?? ""} onChange={(e) => set("civility", e.target.value)} placeholder="Mme / M." />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nom du client *</Label>
              <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Dupont" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Téléphone client</Label>
              <Input value={form.client_phone ?? ""} onChange={(e) => set("client_phone", e.target.value)} placeholder="06…" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone en cas d'absence</Label>
              <Input value={form.client_phone_backup ?? ""} onChange={(e) => set("client_phone_backup", e.target.value)} placeholder="06…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Personne à contacter si absent</Label>
            <Input value={form.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="12 rue des Lilas, 33000 Bordeaux" />
          </div>
          <div className="space-y-1.5">
            <Label>Complément d'accès (optionnel)</Label>
            <Textarea value={form.access_complement ?? ""} onChange={(e) => set("access_complement", e.target.value)} placeholder="Code portail, repère, accès difficile…" rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date d'intervention</Label>
              <Input type="date" value={form.intervention_date ?? ""} onChange={(e) => set("intervention_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Intervenant(e)</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {INTERVENANTS.map((n) => (
                  <Chip key={n} active={form.intervenant === n} onClick={() => set("intervenant", form.intervenant === n ? null : n)}>{n}</Chip>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Toggle label="Client présent" value={form.client_present} onChange={(v) => set("client_present", v)} />
            <Toggle label="Évacuation des déchets verts" value={form.green_waste} onChange={(v) => set("green_waste", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Matériel */}
      <Card>
        <CardHeader><CardTitle className="font-serif">Matériel nécessaire <span className="text-sm font-normal text-muted-foreground">({form.equipment.length})</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {EQUIPMENT_GROUPS.map(({ group, items }) => {
            const open = openGroups[group] ?? false;
            return (
              <div key={group} className="rounded-lg border border-border">
                <button type="button" onClick={() => setOpenGroups((g) => ({ ...g, [group]: !open }))} className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold uppercase tracking-wide text-foreground">
                  {group}
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {open && (
                  <div className="flex flex-wrap gap-2 border-t border-border p-3">
                    {items.map((it) => <Chip key={it} active={form.equipment.includes(it)} onClick={() => toggleIn("equipment", it)}>{it}</Chip>)}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* EPI */}
      <Card>
        <CardHeader><CardTitle className="font-serif">EPI <span className="text-sm font-normal text-muted-foreground">({form.epi.length})</span></CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EPI_OPTIONS.map((e) => <Chip key={e} active={form.epi.includes(e)} onClick={() => toggleIn("epi", e)}>{e}</Chip>)}
          </div>
        </CardContent>
      </Card>

      {/* Travaux */}
      <Card>
        <CardHeader><CardTitle className="font-serif">Travaux à réaliser</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {TASK_GROUPS.map(({ group, items }) => (
            <div key={group} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((it) => <Chip key={it} active={form.tasks.includes(it)} onClick={() => toggleIn("tasks", it)}>{it}</Chip>)}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={customTask} onChange={(e) => setCustomTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTask(); } }} placeholder="Ajouter une tâche personnalisée…" />
            <Button type="button" variant="outline" onClick={addCustomTask}><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-2">
            <Label>Ordre d'exécution</Label>
            {form.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sélectionnez des tâches pour définir leur ordre.</p>
            ) : (
              <ul className="space-y-1.5">
                {form.tasks.map((t, i) => (
                  <li key={t} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                    <span className="font-semibold text-primary">{i + 1}.</span>
                    <span className="flex-1 truncate">{t}</span>
                    <button type="button" disabled={i === 0} onClick={() => moveTask(i, -1)} className="text-muted-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" disabled={i === form.tasks.length - 1} onClick={() => moveTask(i, 1)} className="text-muted-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => toggleIn("tasks", t)} className="text-destructive"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader><CardTitle className="font-serif">Checklist avant départ</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {CHECKLIST_OPTIONS.map((c) => {
              const active = form.checklist.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleChecklist(c)} className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {c}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader><CardTitle className="font-serif">Photos du chantier <span className="text-sm font-normal text-muted-foreground">({form.photos.length})</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {form.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.photos.map((p) => (
                <PhotoThumb key={p} path={p} onRemove={() => set("photos", form.photos.filter((x) => x !== p))} />
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            Ajouter des photos
          </Button>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="font-serif">Notes complémentaires</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Informations utiles pour l'intervention…" />
        </CardContent>
      </Card>

      <Button className="w-full" disabled={submitting} onClick={submit}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}