import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { useAnalytics } from "@/lib/pilot-analytics";
import { formatEuro } from "@/lib/pilot";

/** Exports dirigeant (PDF / Excel) — intégrés aux Paramètres PP. */
export function ReportsCard() {
  const { snapshot, isLoading, isError } = useAnalytics();
  const year = snapshot?.scope.year ?? new Date().getFullYear();

  const series = snapshot?.monthly.caSeries ?? [];
  const clients = snapshot?.clients.ranking ?? [];
  const kpis = snapshot?.kpis;

  const reportRows = useMemo(() => {
    if (!snapshot || !kpis) return [];
    return [
      { label: "CA annuel HT", value: kpis.ca_annuel.value, unit: "eur" },
      { label: "Charges", value: kpis.charges.value, unit: "eur" },
      { label: "Bénéfice", value: kpis.benefice_brut.value, unit: "eur" },
      { label: "Marge %", value: kpis.marge.value, unit: "pct" },
      { label: "Projection", value: snapshot.projection.caProjete, unit: "eur" },
      {
        label: "Taux horaire vendu",
        value: kpis.taux_horaire_vendu.value,
        unit: "eur_heure",
      },
      {
        label: "Taux horaire réel",
        value: kpis.taux_horaire_reel.value,
        unit: "eur_heure",
      },
      {
        label: "TJM réel",
        value: snapshot.tjm.result?.tauxJournalier ?? null,
        unit: "eur_jour",
      },
    ];
  }, [snapshot, kpis]);

  function exportPdf() {
    if (!snapshot || !kpis) return;
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Rapport dirigeant — ${year}`, 14, 20);
      doc.setFontSize(11);
      const lines = reportRows.map(({ label, value, unit }) => {
        if (value == null) return `${label} : n/a`;
        if (unit === "pct") return `${label} : ${Number(value).toFixed(0)} %`;
        if (unit === "eur_heure") return `${label} : ${formatEuro(Number(value))}/h`;
        if (unit === "eur_jour") return `${label} : ${formatEuro(Number(value))}/jour`;
        return `${label} : ${formatEuro(Number(value))}`;
      });
      let yy = 34;
      lines.forEach((line) => {
        doc.text(line, 14, yy);
        yy += 8;
      });
      yy += 4;
      doc.setFontSize(13);
      doc.text("CA mensuel", 14, yy);
      yy += 8;
      doc.setFontSize(10);
      series.forEach((item) => {
        doc.text(`${item.month} : ${formatEuro(item.current)}`, 14, yy);
        yy += 6;
      });
      doc.save(`rapport-pilot-${year}.pdf`);
    } catch {
      toast.error("Erreur PDF");
    }
  }

  function exportXlsx() {
    if (!snapshot || !kpis) return;
    try {
      const wb = XLSX.utils.book_new();
      const kpi = reportRows.map(({ label, value }) => ({
        Indicateur: label,
        Valeur: value,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpi), "Synthese");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          series.map((item) => ({
            Mois: item.month,
            [`${year}`]: item.current,
            [`${year - 1}`]: item.previous,
          })),
        ),
        "CA mensuel",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          clients.map((client) => ({
            Client: client.name,
            CA: Math.round(client.ca),
            "Part %": Math.round(client.share),
            Categorie: client.abc,
          })),
        ),
        "Clients",
      );
      XLSX.writeFile(wb, `rapport-pilot-${year}.xlsx`);
    } catch {
      toast.error("Erreur Excel");
    }
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Chargement des indicateurs…</p>
    );
  }

  if (isError || !snapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        Les indicateurs Pilot sont indisponibles.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-lg font-semibold">Rapports</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h4 className="font-medium">Rapport dirigeant (PDF)</h4>
            <p className="text-sm text-muted-foreground">
              Synthèse des indicateurs clés et du CA mensuel pour {year}.
            </p>
            <Button onClick={exportPdf}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Générer le PDF
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h4 className="font-medium">Export Excel</h4>
            <p className="text-sm text-muted-foreground">
              Synthèse, CA mensuel et rentabilité clients en tableur.
            </p>
            <Button variant="outline" onClick={exportXlsx}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Générer l’Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
