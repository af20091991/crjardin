import { useState, useRef, type ReactNode, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createClient, updateClient, REPORT_POLICY_META, LIFECYCLE_META, CLIENT_SOURCE_LABEL, CLIENT_TYPE_META,
  type Client, type ClientInput, type ReportPolicy, type ClientLifecycle, type ClientType,
} from "@/lib/clients";
import { uploadCeevPlanning, deleteCeevPlanning } from "@/lib/client-portal.functions";
import { toast } from "sonner";
import { Loader2, Plus, X, FileText, Upload, Trash2 } from "lucide-react";

const CONTRACTS = ["Entretien annuel", "Ponctuel", "Création", "Saisonnier"];
const FREQUENCIES = ["Hebdomadaire", "Bimensuelle", "Mensuelle", "Trimestrielle", "Saisonnière"];
const CIVILITIES = ["Madame", "Monsieur", "Madame et Monsieur"];

interface AddressSuggestion { label: string; }

export function ClientForm({ client, initial, trigger, open: openProp, onOpenChange, onSaved }: {
  client?: Client; initial?: ClientInput; trigger: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; onSaved?: (c: Client) => void;
}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => { setOpenInternal(v); onOpenChange?.(v); };
  const qc = useQueryClient();
  const initialEmails = (() => {
    const list = [...((client?.emails ?? initial?.emails) ?? []), ...(client?.email ? [client.email] : initial?.email ? [initial.email] : [])].map((e) => e.trim()).filter(Boolean);
    const uniq = Array.from(new Set(list));
    return uniq.length ? uniq : [""];
  })();
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? initial?.name ?? "",
    client_type: client?.client_type ?? initial?.client_type ?? null,
    civility: client?.civility ?? initial?.civility ?? "",
    address: client?.address ?? initial?.address ?? "",
    phone: client?.phone ?? initial?.phone ?? "+33 ",
    email: client?.email ?? initial?.email ?? "",
    contract_type: client?.contract_type ?? initial?.contract_type ?? "",
    frequency: client?.frequency ?? initial?.frequency ?? "",
    notes: client?.notes ?? initial?.notes ?? "",
    cr_notes: client?.cr_notes ?? "",
    ceev_enabled: client?.ceev_enabled ?? false,
    report_policy: client?.report_policy ?? initial?.report_policy ?? "a_confirmer",
    lifecycle_status: client?.lifecycle_status ?? "actif",
  });
  const [addrSuggestions, setAddrSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [planningBusy, setPlanningBusy] = useState(false);
  const addrAbort = useRef<AbortController | null>(null);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddresses = (q: string) => {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (q.trim().length < 3) { setAddrSuggestions([]); return; }
    addrTimer.current = setTimeout(async () => {
      addrAbort.current?.abort(); const ctrl = new AbortController(); addrAbort.current = ctrl;
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`, { signal: ctrl.signal });
        const data = await res.json();
        const feats = Array.isArray(data?.features) ? data.features : [];
        setAddrSuggestions(feats.map((f: { properties?: { label?: string } }) => ({ label: f.properties?.label ?? "" })).filter((s: AddressSuggestion) => s.label));
        setShowSuggestions(true);
      } catch { /* aborted or network error */ }
    }, 250);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error("Le nom est requis");
      const cleaned = Array.from(new Set(emails.map((e) => e.trim()).filter(Boolean)));
      const payload: ClientInput = { ...form, emails: cleaned, email: cleaned[0] ?? null };
      return client ? updateClient(client.id, payload) : createClient(payload);
    },
    onSuccess: (saved) => { qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["client", saved.id] }); toast.success(client ? "Client mis à jour" : "Client créé"); setOpen(false); onSaved?.(saved); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const set = (k: keyof ClientInput, v: string | null | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const uploadPlanning = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !client) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { toast.error("Le calendrier doit être un PDF"); return; }
    setPlanningBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
        reader.readAsDataURL(file);
      });
      await uploadCeevPlanning({ data: { clientId: client.id, filename: file.name, contentBase64: base64 } });
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      toast.success("Calendrier ajouté au portail client");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Impossible d'ajouter le calendrier"); }
    finally { setPlanningBusy(false); }
  };

  const removePlanning = async () => {
    if (!client) return;
    setPlanningBusy(true);
    try { await deleteCeevPlanning({ data: { clientId: client.id } }); qc.invalidateQueries({ queryKey: ["client", client.id] }); toast.success("Calendrier retiré"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Impossible de retirer le calendrier"); }
    finally { setPlanningBusy(false); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle className="font-serif">{client ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader>
      <div className="space-y-3.5">
        <div className="space-y-1.5"><Label>Type de client</Label><Select value={form.client_type ?? ""} onValueChange={(v) => set("client_type", v as ClientType)}><SelectTrigger><SelectValue placeholder="À définir" /></SelectTrigger><SelectContent>{(Object.keys(CLIENT_TYPE_META) as ClientType[]).map((t) => <SelectItem key={t} value={t}>{CLIENT_TYPE_META[t].label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Particulier, résidence ou professionnel. Le référent sur place n'est pas un type de client.</p></div>
        <div className="space-y-1.5"><Label>Civilité</Label><Select value={form.civility ?? ""} onValueChange={(v) => set("civility", v)}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{CIVILITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Nom *</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Nom du client" /></div>
        <div className="relative space-y-1.5"><Label>Adresse</Label><Input value={form.address ?? ""} onChange={(e) => { set("address", e.target.value); fetchAddresses(e.target.value); }} onFocus={() => { if (addrSuggestions.length) setShowSuggestions(true); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} placeholder="Commencez à saisir l'adresse…" autoComplete="off" />{showSuggestions && addrSuggestions.length > 0 && <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">{addrSuggestions.map((s, i) => <li key={i}><button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(e) => e.preventDefault()} onClick={() => { set("address", s.label); setShowSuggestions(false); }}>{s.label}</button></li>)}</ul>}</div>
        <div className="space-y-1.5"><Label>Téléphone</Label><Input type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+33 6 60 22 13 21" /></div>
        <div className="space-y-1.5"><Label>Adresses e-mail (comptes-rendus)</Label><div className="space-y-2">{emails.map((val, i) => <div key={i} className="flex items-center gap-2"><Input type="email" value={val} onChange={(e) => setEmails((list) => list.map((v, idx) => idx === i ? e.target.value : v))} placeholder="nom@exemple.fr" /><Button type="button" size="icon" variant="ghost" className="shrink-0 text-muted-foreground" disabled={emails.length === 1} onClick={() => setEmails((list) => list.filter((_, idx) => idx !== i))} aria-label="Supprimer cette adresse"><X className="h-4 w-4" /></Button></div>)}</div><Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => setEmails((list) => [...list, ""])}><Plus className="mr-1.5 h-4 w-4" />Ajouter une adresse</Button><p className="text-xs text-muted-foreground">Les comptes-rendus seront envoyés à toutes les adresses renseignées.</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Type de contrat</Label><Select value={form.contract_type ?? ""} onValueChange={(v) => set("contract_type", v)}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{CONTRACTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Fréquence</Label><Select value={form.frequency ?? ""} onValueChange={(v) => set("frequency", v)}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{FREQUENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="space-y-1.5"><Label>Observations importantes</Label><Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Accès, animaux, particularités du jardin…" /></div>
        <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3"><Label>Notes CR Chantier</Label><Textarea value={form.cr_notes ?? ""} onChange={(e) => set("cr_notes", e.target.value)} rows={4} placeholder="Notes internes utiles pour les comptes-rendus…" /><p className="text-xs text-muted-foreground">Notes manuelles internes, visibles dans la fiche client. Elles ne sont pas envoyées automatiquement au client.</p></div>
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between gap-3"><div><Label>CEEV</Label><p className="text-xs text-muted-foreground">Active l'espace calendrier dans le lien privé client.</p></div><Select value={form.ceev_enabled ? "oui" : "non"} onValueChange={(v) => set("ceev_enabled", v === "oui")}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="non">Non</SelectItem><SelectItem value="oui">Oui</SelectItem></SelectContent></Select></div>{form.ceev_enabled && client && <div className="rounded-md border bg-background p-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{client.ceev_planning_filename ?? "Aucun calendrier"}</p><p className="text-xs text-muted-foreground">{client.ceev_planning_updated_at ? `Mis à jour le ${new Date(client.ceev_planning_updated_at).toLocaleDateString("fr-FR")}` : "PDF à ajouter"}</p></div>{client.ceev_planning_path && <Button type="button" variant="ghost" size="icon" disabled={planningBusy} onClick={removePlanning} aria-label="Supprimer le calendrier"><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed py-2 text-sm font-medium hover:bg-accent"><Upload className="h-4 w-4" />{planningBusy ? "Traitement…" : client.ceev_planning_path ? "Remplacer le PDF" : "Ajouter le PDF"}<input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={planningBusy} onChange={uploadPlanning} /></label><p className="mt-1 text-[11px] text-muted-foreground">PDF uniquement · 15 Mo maximum. Le document sera accessible depuis le lien privé du client.</p></div>}</div>
        <div className="space-y-1.5"><Label>Client concerné par l'envoi de comptes-rendus</Label><Select value={form.report_policy ?? "a_confirmer"} onValueChange={(v) => set("report_policy", v as ReportPolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(REPORT_POLICY_META) as ReportPolicy[]).map((p) => <SelectItem key={p} value={p}>{REPORT_POLICY_META[p].label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{REPORT_POLICY_META[(form.report_policy ?? "a_confirmer") as ReportPolicy].hint}</p></div>
        <div className="space-y-1.5"><Label>État commercial du client</Label><Select value={form.lifecycle_status ?? "actif"} onValueChange={(v) => setForm((f) => ({ ...f, lifecycle_status: v as ClientLifecycle, lost_at: v === "perdu" ? new Date().toISOString() : null }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(LIFECYCLE_META) as ClientLifecycle[]).map((p) => <SelectItem key={p} value={p}>{LIFECYCLE_META[p].label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{LIFECYCLE_META[(form.lifecycle_status ?? "actif") as ClientLifecycle].hint}</p></div>
        {client?.source && CLIENT_SOURCE_LABEL[client.source] && <p className="text-xs text-muted-foreground">Origine de la fiche : {CLIENT_SOURCE_LABEL[client.source]}{client.source_confidence ? ` (confiance ${client.source_confidence})` : ""}</p>}
      </div>
      <DialogFooter><Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full sm:w-auto">{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{client ? "Enregistrer" : "Créer le client"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
