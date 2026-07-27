import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { listChargeRows, listSalesByYear, projectionBase, analyzeCharges } from "@/lib/pilot-charges";
import { usePilotMode } from "@/lib/pilot-mode";

/** Synthèse charges fixes / variables de l'année, avec lien vers l'analyse détaillée. */
export function ChargesSummaryCard({ year }: { year: number }) {
  const { mode } = usePilotMode();
  const q = useQuery({
    queryKey: ["pilot-charges-summary", year, mode],
    queryFn: async () => {
      const [rows, sales] = await Promise.all([listChargeRows(), listSalesByYear({ mode })]);
      const analysis = analyzeCharges(rows, sales, [], { mode });
      return {
        year: analysis.years.find((y) => y.year === year) ?? null,
        proj: projectionBase(rows, year, sales),
        unclassified: analysis.unclassifiedCount,
      };
    },
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-primary" />
          Charges {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading && <Skeleton className="h-24 w-full" />}
        {q.data && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Cell label="Fixes" value={formatEuro(q.data.year?.fixe ?? 0)} />
              <Cell label="Variables" value={formatEuro(q.data.year?.variable ?? 0)} />
              <Cell label="Total" value={formatEuro(q.data.year?.total ?? 0)} />
              <Cell
                label="Poids CA"
                value={q.data.year?.weightPct == null ? "—" : `${q.data.year.weightPct.toFixed(0)} %`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Marge disponible à date : {formatEuro(q.data.proj.margeDisponible)} ·{" "}
              {q.data.unclassified} charges à classer.
            </p>
            <Link to="/pilot/charges" className="text-sm font-medium text-primary hover:underline">
              Voir l'analyse des charges →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}