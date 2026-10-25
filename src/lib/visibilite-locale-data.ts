import { fetchAllCaRows } from "@/lib/pilot-ca-fetch";
import { saleRateScope } from "@/lib/pilot-sale-time";
import { querySearchConsole } from "@/lib/site-web-api";
import { SITE_WEB_SITE_URL } from "@/lib/site-web-config";
import { loadCommuneTravel } from "@/lib/visibilite-locale-geo";
import {
  DEFAULT_PROMOTED,
  PRESTATIONS_SCORED,
  computeCapacity,
  monthlyHours,
  type Capacity,
  groupQueries,
  monthlyCaByPrestation,
  scoreOpportunities,
  visibilityGaps,
  type QueryRow,
  type ScoredOpportunity,
  type ScoredPrestation,
} from "@/lib/visibilite-locale";

export interface SaleRow {
  year: number;
  month: number;
  category: string | null;
  amount_ht: number | null;
  hours: number | null;
  intervention_type: string | null;
}

/** Catégorie de vente PP → prestation du radar (CEEV = entretien sous contrat, rattaché à l'entretien). */
export function prestationOfCategory(category: string | null): ScoredPrestation | null {
  switch ((category ?? "").trim().toLowerCase()) {
    case "ap":
      return "AP";
    case "conseil":
      return "Conseil";
    case "sap":
    case "ceev":
      return "SAP";
    default:
      return null;
  }
}

export interface VisibilityRadar {
  generatedAt: string;
  period: { startDate: string; endDate: string };
  opportunities: ScoredOpportunity[];
  gaps: Array<{ prestation: ScoredPrestation; commune: string }>;
  unattachedQueries: number;
  ignoredExcluded: number;
  totalQueries: number;
  hourlyRates: Record<string, number | null>;
  travelEstimated: boolean;
  hasSeasonality: boolean;
  capacity: Capacity;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 90 derniers jours complets (Search Console publie avec ~2 jours de retard). */
export function radarPeriod(now: Date = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 89);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

/** Sources de données substituables : l'actualisation automatique les lit côté serveur, sans session. */
export interface RadarSources {
  searchConsole: (period: {
    startDate: string;
    endDate: string;
  }) => ReturnType<typeof querySearchConsole>;
  sales: () => Promise<SaleRow[]>;
  travel: () => ReturnType<typeof loadCommuneTravel>;
}

export const SALE_COLUMNS = "year,month,category,amount_ht,hours,intervention_type";

export async function loadVisibilityRadar(
  promoted: ScoredPrestation[] = DEFAULT_PROMOTED,
  sources: Partial<RadarSources> = {},
): Promise<VisibilityRadar> {
  const period = radarPeriod();
  const [search, sales, travel] = await Promise.all([
    sources.searchConsole
      ? sources.searchConsole(period)
      : querySearchConsole({ siteUrl: SITE_WEB_SITE_URL, ...period, dimensions: ["query"] }),
    sources.sales ? sources.sales() : fetchAllCaRows<SaleRow>(SALE_COLUMNS, { kind: "vente" }),
    sources.travel ? sources.travel() : loadCommuneTravel(),
  ]);
  if (search.error) {
    throw new Error(
      typeof search.error === "string" ? search.error : "Search Console indisponible",
    );
  }

  const queryRows: QueryRow[] = (search.data?.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    position: row.position,
  }));
  const grouped = groupQueries(queryRows);

  const byPrestation = new Map<ScoredPrestation, SaleRow[]>();
  for (const row of sales) {
    const prestation = prestationOfCategory(row.category);
    if (!prestation) continue;
    byPrestation.set(prestation, [...(byPrestation.get(prestation) ?? []), row]);
  }
  const hourlyRates: Record<string, number | null> = {};
  for (const prestation of PRESTATIONS_SCORED) {
    hourlyRates[prestation] = saleRateScope(byPrestation.get(prestation) ?? []).rate;
  }

  const monthly = monthlyCaByPrestation(
    sales.flatMap((row) => {
      const prestation = prestationOfCategory(row.category);
      if (!prestation) return [];
      return [
        {
          date: `${row.year}-${String(row.month).padStart(2, "0")}-01`,
          amount: Number(row.amount_ht) || 0,
          prestation,
        },
      ];
    }),
  );

  const capacity = computeCapacity(monthlyHours(sales, new Date().getFullYear()));

  const opportunities = scoreOpportunities({
    opportunities: grouped.opportunities,
    hourlyRates,
    travelMinutes: travel.minutes,
    travelKm: travel.km,
    capacity,
    monthly,
    promoted,
  });

  return {
    generatedAt: new Date().toISOString(),
    period,
    opportunities,
    gaps: visibilityGaps(grouped.opportunities, promoted),
    unattachedQueries: grouped.unattached,
    ignoredExcluded: grouped.ignoredExcluded,
    totalQueries: queryRows.length,
    hourlyRates,
    travelEstimated: travel.estimated,
    capacity,
    hasSeasonality: opportunities.some((o) => !o.neutral.includes("saisonnalite")),
  };
}
