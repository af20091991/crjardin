// Rapprochement contrôlé du Temps des ventes avec le fichier Excel source.
// Aucune écriture sans correspondance unique et démontrable ; chaque
// restauration est journalisée (pilot_edit_log) et annulable.
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePilotYear } from "@/lib/pilot-mode";
import {
  listSalesWithUnknownTime,
  readExcelTimeFile,
  reconcileSaleTimes,
  restorationReason,
  restoreSaleTimes,
  TIME_VERDICT_LABEL,
  type ExcelSaleRow,
  type TimeProof,
  type TimeVerdict,
} from "@/lib/pilot-excel-time";

const TONE: Record<TimeVerdict, string> = {
  temps_positif: "border-emerald-200 bg-emerald-50 text-emerald-700",
  zero_confirme: "border-emerald-200 bg-emerald-50 text-emerald-700",
  absent_excel: "border-amber-200 bg-amber-50 text-amber-700",
  ambigu: "border-orange-200 bg-orange-50 text-orange-700",
  valeur_invalide: "border-rose-200 bg-rose-50 text-rose-700",
  excel_introuvable: "border-muted bg-muted text-muted-foreground",
};

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function SaleTimeExcelPanel() {
  const qc = useQueryClient();
  const { year } = usePilotYear();
  const fileRef = useRef<HTMLInputElement>(null);
  const [excel, setExcel] = useState<ExcelSaleRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["pilot-sales-unknown-time", year],
    queryFn: () => listSalesWithUnknownTime(year),
  });

  const reconciliation = useMemo(
    () =>
      reconcileSaleTimes({
        sales,
        excel: excel ?? [],
        excelAvailable: excel != null,
      }),
    [sales, excel],
  );

  const restorable = reconciliation.proofs.filter((p) => p.restorable);

  const restore = useMutation({
    mutationFn: (proofs: TimeProof[]) => restoreSaleTimes(proofs),
    onSuccess: async (count) => {
      toast.success(`${count} temps restauré(s) depuis le fichier Excel`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pilot-sales-unknown-time"] }),
        qc.invalidateQueries({ queryKey: ["pilot-validation"] }),
        qc.invalidateQueries({ queryKey: ["pilot-ca"] }),
        qc.invalidateQueries({ queryKey: ["pilot-quality"] }),
        qc.invalidateQueries({ queryKey: ["pilot-fix-flows"] }),
        qc.invalidateQueries({ queryKey: ["pilot-edit-log"] }),
      ]);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Restauration refusée"),
  });

  async function onFile(file: File) {
    try {
      const rows = await readExcelTimeFile(file);
      if (rows.length === 0) {
        toast.error("Aucune colonne Temps exploitable dans ce fichier.");
        return;
      }
      setExcel(rows);
      setFileName(file.name);
      toast.success(`${rows.length} ligne(s) lue(s) dans ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lecture du fichier impossible");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" />
            Temps des ventes {year} — rapprochement Excel
          </CardTitle>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {fileName ? "Changer de fichier" : "Charger le fichier Excel"}
            </Button>
            <Button
              size="sm"
              disabled={restorable.length === 0 || restore.isPending}
              onClick={() => restore.mutate(restorable)}
            >
              Restaurer {restorable.length} temps démontré(s)
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {fileName
            ? `Source : ${fileName} — ${excel?.length ?? 0} ligne(s). Une cellule vide reste inconnue : jamais convertie en 0.`
            : "Aucun fichier chargé : le temps de ces ventes reste inconnu, aucune valeur n'est déduite."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(Object.keys(TIME_VERDICT_LABEL) as TimeVerdict[]).map((v) => (
            <Badge key={v} variant="outline" className={TONE[v]}>
              {TIME_VERDICT_LABEL[v]} : {reconciliation.counts[v]}
            </Badge>
          ))}
        </div>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Lecture des ventes…</p>
        ) : sales.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Toutes les ventes {year} ont un temps connu (0 h explicite inclus).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Ligne CA</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Preuve</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliation.proofs.map((p) => (
                  <TableRow key={p.saleId}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {String(p.month).padStart(2, "0")}/{p.year}
                    </TableCell>
                    <TableCell className="text-sm">{p.label}</TableCell>
                    <TableCell className="text-right text-sm">{euro(p.amountHt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TONE[p.verdict]}>
                        {TIME_VERDICT_LABEL[p.verdict]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[28rem] text-xs text-muted-foreground">
                      {p.message}
                      <br />
                      <span className="font-mono">
                        {p.restorable ? restorationReason(p) : `clé ${p.key}`}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
