import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { listPendingValidation, setValidation, type PendingValidationLine } from "@/lib/pilot-validation";
import { processCertainPendingValidation } from "@/lib/pilot-validation-auto";

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function ValidationPage() {
  const qc = useQueryClient();
  const autoStarted = useRef(false);
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["pilot-validation"],
    queryFn: () => listPendingValidation(5000),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["pilot-validation"] });

  const validate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "valide" | "a_revoir" }) => setValidation(id, status),
    onSuccess: (_data, variables) => {
      refresh();
      toast.success(variables.status === "valide" ? "Donnée validée" : "Donnée mise à revoir");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const autoProcess = useMutation({
    mutationFn: processCertainPendingValidation,
    onSuccess: (result) => {
      refresh();
      if (result.linked > 0 || result.validated > 0) {
        toast.success(`${result.linked} rapprochement(s) automatique(s) · ${result.validated} validation(s) automatique(s)`);
      }
    },
    onError: (error: Error) => toast.error(`Rapprochement automatique impossible : ${error.message}`),
  });

  // Dès l'ouverture du Centre, PP traite les cas certains. Le ref évite un double lancement.
  useEffect(() => {
    if (!autoStarted.current) {
      autoStarted.current = true;
      autoProcess.mutate();
    }
  }, []);

  const stats = useMemo(() => {
    const financial = lines.filter((l) => l.kind === "vente" || l.kind === "charge");
    return {
      total: lines.length,
      financial: financial.length,
      amount: financial.reduce((sum, l) => sum + Math.abs(l.amount_ht), 0),
      clientsToConfirm: financial.filter((l) => l.kind === "vente" && l.match_status === "non_identifie").length,
    };
  }, [lines]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold">Centre de validation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PP règle automatiquement les cas certains. Vous intervenez uniquement lorsque votre décision est nécessaire.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span><strong>{stats.total}</strong> à traiter</span>
            <span><strong>{stats.financial}</strong> financiers</span>
            <span><strong>{euro(stats.amount)}</strong></span>
            {stats.clientsToConfirm > 0 && (
              <span className="text-amber-700"><strong>{stats.clientsToConfirm}</strong> client(s) à rattacher</span>
            )}
          </div>
          <Button onClick={() => autoProcess.mutate()} disabled={autoProcess.isPending} className="gap-2">
            <Wand2 className="h-4 w-4" />
            {autoProcess.isPending ? "Traitement…" : "Traiter les cas certains"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Votre décision</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || autoProcess.isPending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">PP vérifie les données certaines…</p>
          ) : lines.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium">Tout est traité.</p>
              <p className="mt-1 text-sm text-muted-foreground">Aucune donnée ne demande actuellement votre décision.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donnée</TableHead>
                    <TableHead>Client / classement</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Pourquoi ?</TableHead>
                    <TableHead className="w-[190px] text-right">Décision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.slice(0, 500).map((line) => (
                    <ValidationRow
                      key={line.id}
                      line={line}
                      busy={validate.isPending}
                      onValidate={() => validate.mutate({ id: line.id, status: "valide" })}
                      onReview={() => validate.mutate({ id: line.id, status: "a_revoir" })}
                    />
                  ))}
                </TableBody>
              </Table>
              {lines.length > 500 && (
                <p className="pt-3 text-xs text-muted-foreground">500 premières lignes affichées sur {lines.length}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ValidationRow({ line, busy, onValidate, onReview }: {
  line: PendingValidationLine;
  busy: boolean;
  onValidate: () => void;
  onReview: () => void;
}) {
  const clientState = line.kind === "vente"
    ? line.match_status === "non_identifie" ? "Client à confirmer" : "Client rattaché"
    : line.charge_category || "Classement à confirmer";

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm">{String(line.month).padStart(2, "0")}/{line.year}</TableCell>
      <TableCell>
        <div className="max-w-[360px]">
          <div className="truncate font-medium">{line.designation || "Sans libellé"}</div>
          <div className="text-xs text-muted-foreground">{line.kind === "vente" ? "Vente" : "Charge"}</div>
        </div>
      </TableCell>
      <TableCell><Badge variant="outline">{clientState}</Badge></TableCell>
      <TableCell className="text-right tabular-nums">{euro(line.amount_ht)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {line.reasons.map((reason) => (
            <Badge key={reason} variant="secondary" className="text-xs">
              {reason === "client_non_identifie" ? "Client à rattacher"
                : reason === "charge_a_classer" ? "Charge à classer"
                : reason === "categorie_incertaine" ? "Catégorie à confirmer"
                : "Rémunération"}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={onValidate} disabled={busy} className="gap-1" title="Décision définitive : valider">
            <Check className="h-4 w-4" /> Valider
          </Button>
          <Button size="sm" variant="outline" onClick={onReview} disabled={busy} className="gap-1" title="Décision définitive : mettre à revoir">
            <X className="h-4 w-4" /> À revoir
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
