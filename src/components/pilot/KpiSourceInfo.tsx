import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getKpiContract,
  KPI_RELIABILITY_LABEL,
  type KpiContractId,
} from "@/lib/pilot-kpi-contract";
import type { KpiAudit } from "@/lib/pilot-kpi-audit";

/** Source, calcul et période d'un indicateur, repris du contrat de vérité des KPI. */
export function auditFromContract(id: KpiContractId): KpiAudit | null {
  const found = getKpiContract(id);
  if (!found.found) return null;
  const c = found.contract;
  return {
    sources: c.source,
    calcul: [c.scope, c.excludes.length > 0 ? `Exclus : ${c.excludes.join(", ")}.` : null]
      .filter(Boolean)
      .join(" "),
    periode: c.period,
    fiabilite: `${KPI_RELIABILITY_LABEL[c.reliabilityStatus]} — ${c.missingDataRule}`,
  };
}

/**
 * Petite icône « D'où vient ce chiffre ? » : sources, calcul, période et fiabilité.
 * Fournir `kpiId` (contrat de vérité) ou un `audit` explicite ; sinon rien n'est affiché.
 */
export function KpiSourceInfo({
  kpiId,
  audit,
  className,
}: {
  kpiId?: KpiContractId;
  audit?: KpiAudit;
  className?: string;
}) {
  const data = audit ?? (kpiId ? auditFromContract(kpiId) : null);
  if (!data) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className ?? "h-6 w-6 shrink-0"}
          title="D'où vient ce chiffre ?"
          aria-label="D'où vient ce chiffre ?"
        >
          <ScanSearch className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 text-xs leading-relaxed">
        <p className="font-medium text-foreground">D'où vient ce chiffre ?</p>
        <p>
          <span className="font-medium">Sources : </span>
          {data.sources.join(" · ")}
        </p>
        <p>
          <span className="font-medium">Calcul : </span>
          {data.calcul}
        </p>
        {data.periode && (
          <p>
            <span className="font-medium">Période : </span>
            {data.periode}
          </p>
        )}
        {data.fiabilite && (
          <p>
            <span className="font-medium">Fiabilité : </span>
            {data.fiabilite}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
