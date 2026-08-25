import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { listPendingValidation, setValidation, type PendingValidationLine } from "@/lib/pilot-validation";
import { processCertainPendingValidation } from "@/lib/pilot-validation-auto";

const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const actionFor = (line: PendingValidationLine) => {
  if (line.kind === "vente" && line.match_status === "non_identifie") {
    return { proposal: "PP n'a pas encore identifié le client de cette vente.", consequence: "Confirmer enregistrera cette vente avec le client proposé par PP.", accept: "Rattacher au client proposé" };
  }
  if (line.kind === "charge") {
    if (line.charge_category && line.charge_category !== "a_classer") {
      return { proposal: `PP pense que cette dépense relève de « ${line.charge_category} ».`, consequence: `Confirmer conservera ce classement pour les calculs de charges.`, accept: `Classer en « ${line.charge_category} »` };
    }
    return { proposal: "PP ne sait pas encore comment classer cette dépense.", consequence: "Confirmer indique seulement que cette ligne est une charge validée. PP ne lui inventera pas de catégorie.", accept: "Confirmer cette charge" };
  }
  return { proposal: "PP a besoin de votre décision sur cette donnée.", consequence: "Confirmer permettra à PP d'utiliser cette donnée dans ses calculs.", accept: "Confirmer cette donnée" };
};

export function ValidationPage() {
  const qc = useQueryClient();
  const autoStarted = useRef(false);
  const [autoSummary, setAutoSummary] = useState<{ before: number; linked: number; validated: number } | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const { data: lines = [], isLoading } = useQuery({ queryKey: ["pilot-validation"], queryFn: () => listPendingValidation(5000) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["pilot-validation"] });

  const validate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "valide" | "a_revoir" }) => setValidation(id, status),
    onSuccess: (_data, variables) => { refresh(); toast.success(variables.status === "valide" ? "Décision enregistrée" : "Donnée laissée à revoir"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const autoProcess = useMutation({
    mutationFn: async () => { const before = lines.length; const result = await processCertainPendingValidation(); return { ...result, before }; },
    onMutate: () => setAutoError(null),
    onSuccess: (result) => { setAutoSummary({ before: result.before, linked: result.linked, validated: result.validated }); refresh(); toast.success(`${result.linked} rapprochement(s) · ${result.validated} validation(s) automatiques`); },
    onError: (error: Error) => { setAutoError(error.message); toast.error(`Traitement automatique impossible : ${error.message}`); },
  });

  useEffect(() => { if (!autoStarted.current && !isLoading) { autoStarted.current = true; autoProcess.mutate(); } }, [isLoading]);

  const stats = useMemo(() => {
    const financial = lines.filter((l) => l.kind === "vente" || l.kind === "charge");
    return { total: lines.length, financial: financial.length, amount: financial.reduce((sum, l) => sum + Math.abs(l.amount_ht), 0) };
  }, [lines]);
  const processed = autoSummary ? autoSummary.linked + autoSummary.validated : 0;

  return <div className="space-y-5">
    <header><h1 className="font-display text-2xl font-semibold">Centre de validation</h1><p className="mt-1 text-sm text-muted-foreground">PP traite les cas certains. Pour les autres, vous voyez ce que PP comprend et ce que votre décision va changer.</p></header>
    <Card><CardContent className="py-5">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm text-muted-foreground">À décider maintenant</p><div className="mt-1 flex flex-wrap items-baseline gap-x-5"><span className="text-2xl font-semibold">{stats.total}</span><span className="text-sm text-muted-foreground">{stats.financial} financiers</span><span className="text-sm font-medium">{euro(stats.amount)}</span></div></div><Button onClick={() => autoProcess.mutate()} disabled={autoProcess.isPending}><Wand2 className="mr-2 h-4 w-4" />{autoProcess.isPending ? "PP travaille…" : "Traiter les cas certains"}</Button></div>
      {autoSummary && <div className="mt-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm"><div className="font-medium">Dernier traitement automatique</div><div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground"><span><strong className="text-foreground">{autoSummary.before}</strong> au départ</span><span><strong className="text-foreground">{autoSummary.linked}</strong> rapprochés par PP</span><span><strong className="text-foreground">{autoSummary.validated}</strong> validés par PP</span><span><strong className="text-foreground">{stats.total}</strong> restent à décider</span></div></div>}
      {autoError && <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"><strong>Le traitement automatique a échoué :</strong> {autoError}</div>}
    </CardContent></Card>
    <Card><CardContent className="pt-5">
      {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Chargement des données…</p> : lines.length === 0 ? <div className="py-10 text-center"><p className="font-medium">Aucune décision nécessaire.</p>{autoSummary && <p className="mt-2 text-sm text-muted-foreground">PP a traité {processed} donnée(s) automatiquement.</p>}</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Donnée</TableHead><TableHead>Type</TableHead><TableHead>Montant</TableHead><TableHead>Ce que PP comprend</TableHead><TableHead>Votre choix</TableHead></TableRow></TableHeader><TableBody>{lines.slice(0, 500).map((line) => <ValidationRow key={line.id} line={line} busy={validate.isPending} onValidate={() => validate.mutate({ id: line.id, status: "valide" })} onReview={() => validate.mutate({ id: line.id, status: "a_revoir" })} />)}</TableBody></Table>{lines.length > 500 && <p className="pt-3 text-xs text-muted-foreground">500 premières lignes affichées sur {lines.length}.</p>}</div>}
    </CardContent></Card>
  </div>;
}

function ValidationRow({ line, busy, onValidate, onReview }: { line: PendingValidationLine; busy: boolean; onValidate: () => void; onReview: () => void }) {
  const action = actionFor(line);
  const type = line.kind === "vente" ? "Vente" : "Charge";
  const designation = line.designation || (line.kind === "charge" ? "Dépense sans libellé" : "Vente sans libellé");
  return <TableRow>
    <TableCell className="whitespace-nowrap text-sm">{String(line.month).padStart(2, "0")}/{line.year}</TableCell>
    <TableCell><div className="max-w-[330px]"><div className="truncate font-medium">{designation}</div></div></TableCell>
    <TableCell>{type}</TableCell>
    <TableCell className="text-right tabular-nums">{euro(line.amount_ht)}</TableCell>
    <TableCell><div className="font-medium text-sm">{action.proposal}</div><div className="mt-1 text-xs text-muted-foreground">{action.consequence}</div></TableCell>
    <TableCell><div className="flex flex-col items-start gap-2"><Button size="sm" onClick={onValidate} disabled={busy} className="w-full gap-1"><Check className="h-4 w-4" /> {action.accept}</Button><Button size="sm" variant="outline" onClick={onReview} disabled={busy} className="w-full gap-1"><X className="h-4 w-4" /> Laisser cette donnée en attente</Button></div></TableCell>
  </TableRow>;
}
