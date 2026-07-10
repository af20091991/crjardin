import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { computeKpis, monthlySeries, clientStats, MONTHS, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/_authenticated/pilot/rapports")({
  component: RapportsPage,
});

function RapportsPage() {
  const { entries, charges, objectives, settings } = usePilotData();
  const year = new Date().getFullYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const k = useMemo(
    () => computeKpis({ entries: entries.data ?? [], charges: charges.data ?? [], objectives: objectives.data ?? [], settings: set, year, month: new Date().getMonth() }),
    [entries.data, charges.data, objectives.data, set, year],
  );
  const series = useMemo(() => monthlySeries(entries.data ?? [], year), [entries.data, year]);
  const cstats = useMemo(() => clientStats(entries.data ?? [], year), [entries.data, year]);

  function exportPdf() {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text(`Rapport dirigeant — ${year}`, 14, 20);
      doc.setFontSize(11);
      const lines = [
        `CA annuel HT : ${formatEuro(k.caYear)}`,
        `Benefice estime : ${formatEuro(k.benefice)} (marge ${k.marge.toFixed(0)} %)`,
        `Charges annuelles : ${formatEuro(k.chargesYear)}`,
        `Projection fin d'annee : ${formatEuro(k.projection)}`,
        `Objectif : ${k.target > 0 ? `${formatEuro(k.target)} (${k.objectifPct.toFixed(0)} %)` : "non defini"}`,
        `TJM reel : ${formatEuro(k.tjm)} - Taux horaire : ${formatEuro(k.tauxHoraire)}/h`,
        `Panier moyen : ${formatEuro(k.panierMoyen)} - ${k.nbEntries} interventions`,
      ];
      let yy = 34; lines.forEach((l) => { doc.text(l, 14, yy); yy += 8; });
      yy += 4; doc.setFontSize(13); doc.text("CA mensuel", 14, yy); yy += 8; doc.setFontSize(10);
      series.forEach((s, i) => { if (s.current) { doc.text(`${MONTHS[i]} : ${formatEuro(s.current)}`, 14, yy); yy += 6; } });
      doc.save(`rapport-pilot-${year}.pdf`);
    } catch { toast.error("Erreur PDF"); }
  }

  function exportXlsx() {
    try {
      const wb = XLSX.utils.book_new();
      const kpi = [
        { Indicateur: "CA annuel HT", Valeur: k.caYear },
        { Indicateur: "Charges", Valeur: k.chargesYear },
        { Indicateur: "Benefice", Valeur: k.benefice },
        { Indicateur: "Marge %", Valeur: Math.round(k.marge) },
        { Indicateur: "Projection", Valeur: Math.round(k.projection) },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpi), "Synthese");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(series.map((s, i) => ({ Mois: MONTHS[i], [`${year}`]: s.current, [`${year - 1}`]: s.previous }))), "CA mensuel");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cstats.map((c) => ({ Client: c.name, CA: Math.round(c.ca), "Part %": Math.round(c.share), Categorie: c.abc }))), "Clients");
      XLSX.writeFile(wb, `rapport-pilot-${year}.xlsx`);
    } catch { toast.error("Erreur Excel"); }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-lg font-semibold">Rapports</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="space-y-3 pt-6">
          <h4 className="font-medium">Rapport dirigeant (PDF)</h4>
          <p className="text-sm text-muted-foreground">Synthese des indicateurs cles et du CA mensuel pour {year}.</p>
          <Button onClick={exportPdf}><FileDown className="mr-1.5 h-4 w-4" />Generer le PDF</Button>
        </CardContent></Card>
        <Card><CardContent className="space-y-3 pt-6">
          <h4 className="font-medium">Export Excel</h4>
          <p className="text-sm text-muted-foreground">Synthese, CA mensuel et rentabilite clients en tableur.</p>
          <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="mr-1.5 h-4 w-4" />Generer l'Excel</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}