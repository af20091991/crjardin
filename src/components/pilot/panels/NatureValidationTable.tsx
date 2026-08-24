// Tableau des natures à qualifier : toutes les lignes en attente sont visibles
// simultanément, avec pagination « Afficher 25 lignes de plus » et un choix de
// nature directement sur chaque ligne.
//
// Ordre de rapprochement : Excel → correspondance exacte de la désignation →
// classement Pilot Pro. Le fichier Excel, quand il est chargé, sert de
// référence Ventes / Charges et fait remonter les conflits en tête de file.
// Aucune écriture automatique : la décision est écrite par
// pilot-nature-validation.ts sur un clic humain.
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NATURE_CHOICES,
  NATURE_LABELS,
  buildNatureQueue,
  listFinancialLines,
  setLineNature,
  type LineNature,
  type NatureLine,
} from "@/lib/pilot-nature-validation";
import {
  EXCEL_NATURE_LABEL,
  readExcelNatureFile,
  type ExcelNatureIndex,
} from "@/lib/pilot-excel-nature";

const NATURES: LineNature[] = NATURE_CHOICES;
const PAGE_SIZE = 25;
const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export function NatureValidationTable({ rows }: { rows?: NatureLine[] } = {}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [excel, setExcel] = useState<ExcelNatureIndex | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["nature-validation"],
    queryFn: () => listFinancialLines(),
    enabled: rows === undefined,
  });
  const [done, setDone] = useState<string[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const queue = useMemo(() => {
    const source =
      rows !== undefined
        ? rows.map((r) => ({ ...r, needsDecision: true }))
        : (q.data ?? []);
    return buildNatureQueue(
      source.filter((r) => !done.includes(r.id)),
      excel,
    );
  }, [rows, q.data, done, excel]);

  const shown = queue.slice(0, visible);
  const conflicts = queue.filter((i) => i.reason === "conflit").length;

  const m = useMutation({
    mutationFn: ({ row, nature }: { row: NatureLine; nature: LineNature }) =>
      setLineNature(row, nature),
    onSuccess: (_d, v) => {
      setDone((prev) => [...prev, v.row.id]);
      toast.success(`${NATURE_LABELS[v.nature]} enregistrée`);
      qc.invalidateQueries({ queryKey: ["fix", "charges"] });
      qc.invalidateQueries({ queryKey: ["fix-plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    try {
      const index = await readExcelNatureFile(file);
      if (index.blocksFound.length === 0) {
        toast.error("Aucun bloc Ventes ou Charges identifié dans ce fichier.");
        return;
      }
      setExcel(index);
      setFileName(file.name);
      setVisible(PAGE_SIZE);
      toast.success(
        `${index.entries.size} désignation(s) lue(s) — ${index.salesRows} ligne(s) Ventes, ${index.chargeRows} ligne(s) Charges`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lecture du fichier impossible");
    }
  }

  if (rows === undefined && q.isLoading) return <Skeleton className="h-56 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            Référence Excel {fileName ? `— ${fileName}` : "(facultative)"}
          </p>
          {excel ? (
            <p>
              Blocs identifiés :{" "}
              {excel.blocksFound.map((b) => EXCEL_NATURE_LABEL[b]).join(" et ") || "aucun"} ·{" "}
              {excel.salesRows} ligne(s) Ventes · {excel.chargeRows} ligne(s) Charges ·
              rapprochement sur la désignation exacte, jamais approximative.
            </p>
          ) : (
            <p>
              Chargez le fichier financier pour déterminer d'abord dans Excel si une désignation
              appartient aux Ventes ou aux Charges. Aucune ligne n'est déplacée automatiquement.
            </p>
          )}
        </div>
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
            {excel ? "Remplacer le fichier" : "Charger le fichier Excel"}
          </Button>
          {excel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExcel(null);
                setFileName(null);
              }}
            >
              Retirer
            </Button>
          )}
        </div>
      </div>

      {conflicts > 0 && (
        <p className="text-xs text-amber-700">
          {conflicts} conflit(s) Excel / Pilot Pro à vérifier — aucune donnée n'a été modifiée.
        </p>
      )}

      {queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune donnée à valider.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Désignation</th>
                  <th className="px-3 py-2">Emplacement</th>
                  <th className="px-3 py-2">Excel</th>
                  <th className="px-3 py-2">Période</th>
                  <th className="px-3 py-2 text-right">Montant HT</th>
                  <th className="px-3 py-2">Nature retenue</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ line: row, reason, comparison }) => (
                  <tr
                    key={row.id}
                    data-nature-row={row.id}
                    data-nature-reason={reason}
                    className="border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">
                      {row.designation}
                      {reason === "conflit" && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-amber-200 bg-amber-50 text-amber-700"
                        >
                          Conflit à vérifier
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.placement}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {comparison.excel ? EXCEL_NATURE_LABEL[comparison.excel] : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {String(row.month).padStart(2, "0")}/{row.year}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{euro(row.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {NATURES.map((n) => (
                          <Button
                            key={n}
                            size="sm"
                            variant={n === "vente" ? "default" : "secondary"}
                            disabled={m.isPending}
                            onClick={() => m.mutate({ row, nature: n })}
                          >
                            {NATURE_LABELS[n]}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {shown.length} / {queue.length} ligne(s) affichée(s)
            </span>
            {queue.length > shown.length && (
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Afficher {PAGE_SIZE} lignes de plus
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
