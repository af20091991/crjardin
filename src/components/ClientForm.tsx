import { useState, useRef, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient, updateClient, type Client, type ClientInput } from "@/lib/clients";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CONTRACTS = ["Entretien annuel", "Ponctuel", "Création", "Saisonnier"];
const FREQUENCIES = ["Hebdomadaire", "Bimensuelle", "Mensuelle", "Trimestrielle", "Saisonnière"];
const CIVILITIES = ["Madame", "Monsieur", "Madame et Monsieur"];

interface AddressSuggestion {
  label: string;
}

export function ClientForm({
  client,
  trigger,
  onSaved,
}: {
  client?: Client;
  trigger: ReactNode;
  onSaved?: (c: Client) => void;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? "",
    civility: client?.civility ?? "",
    address: client?.address ?? "",
    phone: client?.phone ?? "+33 ",
    email: client?.email ?? "",
    contract_type: client?.contract_type ?? "",
    frequency: client?.frequency ?? "",
    notes: client?.notes ?? "",
  });

  // Address autocomplete via the French Base Adresse Nationale (no key required)
  const [addrSuggestions, setAddrSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addrAbort = useRef<AbortController | null>(null);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddresses = (q: string) => {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (q.trim().length < 3) {
      setAddrSuggestions([]);
      return;
    }
    addrTimer.current = setTimeout(async () => {
      addrAbort.current?.abort();
      const ctrl = new AbortController();
      addrAbort.current = ctrl;
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        const feats = Array.isArray(data?.features) ? data.features : [];
        setAddrSuggestions(feats.map((f: { properties?: { label?: string } }) => ({ label: f.properties?.label ?? "" })).filter((s: AddressSuggestion) => s.label));
        setShowSuggestions(true);
      } catch {
        /* aborted or network error — ignore */
      }
    }, 250);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Le nom est requis");
      return client ? updateClient(client.id, form) : createClient(form);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", saved.id] });
      toast.success(client ? "Client mis à jour" : "Client créé");
      setOpen(false);
      onSaved?.(saved);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const set = (k: keyof ClientInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{client ? "Modifier le client" : "Nouveau client"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label>Civilité</Label>
            <Select value={form.civility ?? ""} onValueChange={(v) => set("civility", v)}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {CIVILITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nom *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nom du client" />
          </div>
          <div className="relative space-y-1.5">
            <Label>Adresse</Label>
            <Input
              value={form.address ?? ""}
              onChange={(e) => { set("address", e.target.value); fetchAddresses(e.target.value); }}
              onFocus={() => { if (addrSuggestions.length) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Commencez à saisir l'adresse…"
              autoComplete="off"
            />
            {showSuggestions && addrSuggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                {addrSuggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { set("address", s.label); setShowSuggestions(false); }}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+33 6 60 22 13 21"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="nom@exemple.fr"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type de contrat</Label>
              <Select value={form.contract_type ?? ""} onValueChange={(v) => set("contract_type", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {CONTRACTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fréquence</Label>
              <Select value={form.frequency ?? ""} onValueChange={(v) => set("frequency", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observations importantes</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Accès, animaux, particularités du jardin…" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full sm:w-auto">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {client ? "Enregistrer" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}