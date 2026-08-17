import { supabase } from "@/integrations/supabase/client";
import {
  historyScopeForYears,
  isOutOfCertificationScope,
  splitByCertificationScope,
  type HistoryScope,
} from "@/lib/pilot-history-scope";

export interface YearCoverage {
  year: number;
  ventesHt: number;
  chargesHt: number;
  linesTotal: number;
  linesLinked: number;
  ventesLinkedHt: number;
  coverageAmountPct: number;
  coverageLinesPct: number;
  /** Exercice antérieur à 2026 : absence assumée, hors certification. */
  outOfScope: boolean;
}

export interface CoverageSummary {
  years: YearCoverage[];
  totalVentesHt: number;
  totalChargesHt: number;
  totalLines: number;
  totalLinesLinked: number;
  totalVentesLinkedHt: number;
  overallAmountPct: number;
  overallLinesPct: number;
  /** Qualification du périmètre couvert par les exercices présents. */
  scope: HistoryScope;
  /**
   * Couverture calculée UNIQUEMENT sur les exercices certifiables (≥ 2026) :
   * l'historique manquant ne dégrade jamais ces valeurs.
   */
  certifiableVentesHt: number;
  certifiableVentesLinkedHt: number;
  certifiableLines: number;
  certifiableLinesLinked: number;
  certifiableAmountPct: number;
  certifiableLinesPct: number;
}

type Row = {
  year: number;
  kind: string;
  amount_ht: number | null;
  client_id: string | null;
};

export async function getCoverageSummary(): Promise<CoverageSummary> {
  const rows: Row[] = [];
  const pageSize = 1000;
  let from = 0;
  // Pagination pour dépasser la limite implicite de 1000 lignes.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("pilot_ca_entries")
      .select("year,kind,amount_ht,client_id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as Row[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const byYear = new Map<number, YearCoverage>();
  let totalVentesHt = 0;
  let totalChargesHt = 0;
  let totalLines = 0;
  let totalLinesLinked = 0;
  let totalVentesLinkedHt = 0;

  for (const r of rows) {
    const y = r.year;
    if (!byYear.has(y)) {
      byYear.set(y, {
        year: y,
        ventesHt: 0,
        chargesHt: 0,
        linesTotal: 0,
        linesLinked: 0,
        ventesLinkedHt: 0,
        coverageAmountPct: 0,
        coverageLinesPct: 0,
        outOfScope: isOutOfCertificationScope(y),
      });
    }
    const bucket = byYear.get(y)!;
    const amt = Number(r.amount_ht) || 0;
    if (r.kind === "vente") {
      bucket.ventesHt += amt;
      bucket.linesTotal += 1;
      totalVentesHt += amt;
      totalLines += 1;
      if (r.client_id) {
        bucket.linesLinked += 1;
        bucket.ventesLinkedHt += amt;
        totalLinesLinked += 1;
        totalVentesLinkedHt += amt;
      }
    } else if (r.kind === "charge") {
      bucket.chargesHt += amt;
      totalChargesHt += amt;
    }
  }

  byYear.forEach((b) => {
    b.coverageAmountPct = b.ventesHt > 0 ? (b.ventesLinkedHt / b.ventesHt) * 100 : 0;
    b.coverageLinesPct = b.linesTotal > 0 ? (b.linesLinked / b.linesTotal) * 100 : 0;
  });

  const years = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  const { certifiable } = splitByCertificationScope(years);
  const certifiableVentesHt = certifiable.reduce((s, y) => s + y.ventesHt, 0);
  const certifiableVentesLinkedHt = certifiable.reduce((s, y) => s + y.ventesLinkedHt, 0);
  const certifiableLines = certifiable.reduce((s, y) => s + y.linesTotal, 0);
  const certifiableLinesLinked = certifiable.reduce((s, y) => s + y.linesLinked, 0);

  return {
    years,
    totalVentesHt,
    totalChargesHt,
    totalLines,
    totalLinesLinked,
    totalVentesLinkedHt,
    overallAmountPct: totalVentesHt > 0 ? (totalVentesLinkedHt / totalVentesHt) * 100 : 0,
    overallLinesPct: totalLines > 0 ? (totalLinesLinked / totalLines) * 100 : 0,
    scope: historyScopeForYears(years.map((y) => y.year)),
    certifiableVentesHt,
    certifiableVentesLinkedHt,
    certifiableLines,
    certifiableLinesLinked,
    certifiableAmountPct:
      certifiableVentesHt > 0 ? (certifiableVentesLinkedHt / certifiableVentesHt) * 100 : 0,
    certifiableLinesPct:
      certifiableLines > 0 ? (certifiableLinesLinked / certifiableLines) * 100 : 0,
  };
}