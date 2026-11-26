// Catalogue des graphiques ajoutables au dashboard.
//
// Présentation seule : chaque graphique est construit à partir de données DÉJÀ
// calculées par les modules métier (pilot-ca, pilot, pilot-intervention-count).
// Aucun calcul métier nouveau, aucune valeur inventée : quand la donnée manque,
// le graphique est vide et la carte affiche « données insuffisantes ».

import type { CaEntry, MonthTotals } from "@/lib/pilot-ca";
import type { ClientStat } from "@/lib/pilot";
import { PP_COLORS } from "@/lib/pilot-colors";

export type WidgetUnit = "euro" | "pct" | "hours" | "euro-hour" | "count";
export type WidgetKind = "series" | "share";
export type WidgetGroup = "Chiffre d'affaires" | "Résultat et charges" | "Temps" | "Clients";

export const WIDGET_GROUPS: WidgetGroup[] = [
  "Chiffre d'affaires",
  "Résultat et charges",
  "Temps",
  "Clients",
];

export interface TypeOption {
  value: string;
  label: string;
}

/** Types de graphique proposés (mêmes valeurs que DashboardCharts). */
export const WIDGET_SERIES_TYPES: readonly TypeOption[] = [
  { value: "barres", label: "Barres" },
  { value: "lignes", label: "Lignes" },
  { value: "aires", label: "Aires" },
];

export const WIDGET_STACK_TYPES: readonly TypeOption[] = [
  { value: "empile", label: "Barres empilées" },
  { value: "barres", label: "Barres groupées" },
  { value: "lignes", label: "Lignes" },
  { value: "aires", label: "Aires" },
];

export const WIDGET_SHARE_TYPES: readonly TypeOption[] = [
  { value: "donut", label: "Anneau" },
  { value: "camembert", label: "Camembert" },
  { value: "barres", label: "Barres horizontales" },
];

export interface WidgetContext {
  /** Lignes de Chiffre d'affaires de l'exercice (pilot_ca_entries). */
  entries: CaEntry[];
  /** Totaux mensuels (yearTotals(...).months), périmètre temporel central. */
  months: MonthTotals[];
  /** CA mensuel N et N-1 (monthlySeries). */
  monthlyCa: Array<{ current: number; previous: number }>;
  /** Classement clients de l'exercice, déjà filtré sur l'éligibilité au classement. */
  clients: ClientStat[];
  /** Nombre d'interventions (lignes de vente) par mois, 12 valeurs. */
  interventionsByMonth: number[];
  /** Mois courant, 0 à 11 : au-delà, les cumuls restent vides. */
  currentMonth: number;
  /** Libellés des 12 mois. */
  monthLabels: string[];
  /** Année affichée (libellés N / N-1). */
  year: number;
}

export interface WidgetSeriesDef {
  key: string;
  color: string;
  kind?: "bar" | "line";
}

export type WidgetData =
  | {
      kind: "series";
      rows: Array<Record<string, string | number | null>>;
      series: WidgetSeriesDef[];
    }
  | { kind: "share"; rows: Array<{ name: string; value: number }> };

export interface WidgetDef {
  id: string;
  label: string;
  description: string;
  group: WidgetGroup;
  kind: WidgetKind;
  unit: WidgetUnit;
  types: readonly TypeOption[];
  defaultType: string;
  build: (ctx: WidgetContext) => WidgetData;
}

const round = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;

function monthRows(
  ctx: WidgetContext,
  values: Record<string, Array<number | null>>,
): Array<Record<string, string | number | null>> {
  return ctx.monthLabels.map((label, index) => {
    const row: Record<string, string | number | null> = { label };
    for (const [key, list] of Object.entries(values)) row[key] = list[index] ?? null;
    return row;
  });
}

/** Valeur conservée jusqu'au mois courant, vide au-delà (pas de courbe plate dans le futur). */
function untilNow(ctx: WidgetContext, values: number[]): Array<number | null> {
  return values.map((value, index) => (index <= ctx.currentMonth ? value : null));
}

function cumulate(values: number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}

const seriesWidget = (
  ctx: WidgetContext,
  values: Record<string, Array<number | null>>,
  series: WidgetSeriesDef[],
): WidgetData => ({ kind: "series", rows: monthRows(ctx, values), series });

const labelN = (ctx: WidgetContext) => String(ctx.year);
const labelN1 = (ctx: WidgetContext) => String(ctx.year - 1);

function chargeLines(ctx: WidgetContext): CaEntry[] {
  return ctx.entries.filter((entry) => entry.kind === "charge" && !entry.is_investment);
}

function sumBy<T>(rows: T[], key: (row: T) => string, amount: (row: T) => number) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + amount(row));
  return map;
}

function shareRows(map: Map<string, number>, max = 7): Array<{ name: string; value: number }> {
  const sorted = [...map.entries()]
    .map(([name, value]) => ({ name, value: round(value) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1).reduce((sum, row) => sum + row.value, 0);
  return [...head, { name: "Autres", value: rest }];
}

const STATUS_LABELS: Record<string, string> = {
  regle: "Réglé",
  realise: "Réalisé",
  planifie: "Planifié",
  particulier: "Particulier",
};

const CHARGE_CLASS_LABELS: Record<string, string> = {
  fixe: "Fixes",
  variable: "Variables",
  a_classer: "À classer",
};

const CLIENT_NAME_MAX = 22;

export const DASHBOARD_WIDGETS: WidgetDef[] = [
  {
    id: "ca-cumule",
    label: "CA cumulé N / N-1",
    description: "Cumul du chiffre d'affaires mois après mois, comparé à l'année précédente.",
    group: "Chiffre d'affaires",
    kind: "series",
    unit: "euro",
    types: WIDGET_SERIES_TYPES,
    defaultType: "lignes",
    build: (ctx) =>
      seriesWidget(
        ctx,
        {
          [labelN(ctx)]: untilNow(ctx, cumulate(ctx.monthlyCa.map((m) => round(m.current)))),
          [labelN1(ctx)]: cumulate(ctx.monthlyCa.map((m) => round(m.previous))),
        },
        [
          { key: labelN(ctx), color: PP_COLORS.primary },
          { key: labelN1(ctx), color: PP_COLORS.neutral },
        ],
      ),
  },
  {
    id: "ca-vs-n1",
    label: "CA mensuel N / N-1",
    description: "Chiffre d'affaires de chaque mois face au même mois de l'année précédente.",
    group: "Chiffre d'affaires",
    kind: "series",
    unit: "euro",
    types: WIDGET_SERIES_TYPES,
    defaultType: "barres",
    build: (ctx) =>
      seriesWidget(
        ctx,
        {
          [labelN(ctx)]: ctx.monthlyCa.map((m) => round(m.current)),
          [labelN1(ctx)]: ctx.monthlyCa.map((m) => round(m.previous)),
        },
        [
          { key: labelN(ctx), color: PP_COLORS.primary },
          { key: labelN1(ctx), color: PP_COLORS.neutral },
        ],
      ),
  },
  {
    id: "ca-trimestre",
    label: "CA par trimestre",
    description: "Chiffre d'affaires de chaque trimestre, comparé à l'année précédente.",
    group: "Chiffre d'affaires",
    kind: "series",
    unit: "euro",
    types: WIDGET_SERIES_TYPES,
    defaultType: "barres",
    build: (ctx) => {
      const quarter = (list: number[], q: number) =>
        round(list.slice(q * 3, q * 3 + 3).reduce((sum, value) => sum + value, 0));
      const current = ctx.monthlyCa.map((m) => m.current);
      const previous = ctx.monthlyCa.map((m) => m.previous);
      return {
        kind: "series",
        rows: [0, 1, 2, 3].map((q) => ({
          label: `T${q + 1}`,
          [labelN(ctx)]: quarter(current, q),
          [labelN1(ctx)]: quarter(previous, q),
        })),
        series: [
          { key: labelN(ctx), color: PP_COLORS.primary },
          { key: labelN1(ctx), color: PP_COLORS.neutral },
        ],
      };
    },
  },
  {
    id: "ca-statuts",
    label: "Répartition du CA par statut",
    description: "Part des ventes réglées, réalisées, planifiées et particulières sur l'année.",
    group: "Chiffre d'affaires",
    kind: "share",
    unit: "euro",
    types: WIDGET_SHARE_TYPES,
    defaultType: "donut",
    build: (ctx) => {
      const sales = ctx.entries.filter((entry) => entry.kind === "vente");
      const map = sumBy(
        sales,
        (entry) => STATUS_LABELS[entry.sale_status ?? ""] ?? "Autre statut",
        (entry) => Number(entry.amount_ht) || 0,
      );
      return { kind: "share", rows: shareRows(map) };
    },
  },
  {
    id: "ca-charges-mensuel",
    label: "CA et charges par mois",
    description: "Chiffre d'affaires et charges d'exploitation face à face, mois par mois.",
    group: "Résultat et charges",
    kind: "series",
    unit: "euro",
    types: WIDGET_SERIES_TYPES,
    defaultType: "barres",
    build: (ctx) =>
      seriesWidget(
        ctx,
        {
          CA: ctx.months.map((m) => round(m.ventesHt)),
          Charges: ctx.months.map((m) => round(m.chargesHt)),
        },
        [
          { key: "CA", color: PP_COLORS.sales },
          { key: "Charges", color: PP_COLORS.charges },
        ],
      ),
  },
  {
    id: "resultat-mensuel",
    label: "Résultat par mois",
    description: "Chiffre d'affaires moins charges, mois par mois, jusqu'au mois en cours.",
    group: "Résultat et charges",
    kind: "series",
    unit: "euro",
    types: WIDGET_SERIES_TYPES,
    defaultType: "barres",
    build: (ctx) =>
      seriesWidget(
        ctx,
        {
          Résultat: untilNow(
            ctx,
            ctx.months.map((m) => round(m.benefice)),
          ),
        },
        [{ key: "Résultat", color: PP_COLORS.primary }],
      ),
  },
  {
    id: "resultat-cumule",
    label: "Résultat cumulé",
    description: "Cumul du résultat (CA − charges) depuis janvier.",
    group: "Résultat et charges",
    kind: "series",
    unit: "euro",
    types: WIDGET_SERIES_TYPES,
    defaultType: "aires",
    build: (ctx) =>
      seriesWidget(
        ctx,
        { "Résultat cumulé": untilNow(ctx, cumulate(ctx.months.map((m) => round(m.benefice)))) },
        [{ key: "Résultat cumulé", color: PP_COLORS.primary }],
      ),
  },
  {
    id: "taux-charges",
    label: "Poids des charges dans le CA",
    description: "Charges en pourcentage du chiffre d'affaires, pour les mois avec du CA.",
    group: "Résultat et charges",
    kind: "series",
    unit: "pct",
    types: WIDGET_SERIES_TYPES,
    defaultType: "lignes",
    build: (ctx) =>
      seriesWidget(
        ctx,
        {
          "Charges / CA": ctx.months.map((m) =>
            m.ventesHt > 0 ? round1((m.chargesHt / m.ventesHt) * 100) : null,
          ),
        },
        [{ key: "Charges / CA", color: PP_COLORS.charges }],
      ),
  },
  {
    id: "charges-fixes-variables",
    label: "Charges fixes et variables",
    description: "Charges d'exploitation de chaque mois, selon leur classification.",
    group: "Résultat et charges",
    kind: "series",
    unit: "euro",
    types: WIDGET_STACK_TYPES,
    defaultType: "empile",
    build: (ctx) => {
      const lines = chargeLines(ctx);
      const perClass = (cls: string) =>
        ctx.monthLabels.map((_, index) =>
          round(
            lines
              .filter(
                (line) => line.month === index + 1 && (line.charge_class ?? "a_classer") === cls,
              )
              .reduce((sum, line) => sum + (Number(line.amount_ht) || 0), 0),
          ),
        );
      return seriesWidget(
        ctx,
        {
          [CHARGE_CLASS_LABELS.fixe]: perClass("fixe"),
          [CHARGE_CLASS_LABELS.variable]: perClass("variable"),
          [CHARGE_CLASS_LABELS.a_classer]: perClass("a_classer"),
        },
        [
          { key: CHARGE_CLASS_LABELS.fixe, color: PP_COLORS.business },
          { key: CHARGE_CLASS_LABELS.variable, color: PP_COLORS.mid },
          { key: CHARGE_CLASS_LABELS.a_classer, color: PP_COLORS.neutral },
        ],
      );
    },
  },
  {
    id: "charges-categories",
    label: "Charges par catégorie",
    description: "Répartition des charges d'exploitation de l'année par catégorie.",
    group: "Résultat et charges",
    kind: "share",
    unit: "euro",
    types: WIDGET_SHARE_TYPES,
    defaultType: "donut",
    build: (ctx) => ({
      kind: "share",
      rows: shareRows(
        sumBy(
          chargeLines(ctx),
          (line) => line.charge_category?.trim() || "Non classée",
          (line) => Number(line.amount_ht) || 0,
        ),
      ),
    }),
  },
  {
    id: "heures-mensuelles",
    label: "Heures par mois",
    description: "Temps compté (Vente → Temps) de chaque mois.",
    group: "Temps",
    kind: "series",
    unit: "hours",
    types: WIDGET_SERIES_TYPES,
    defaultType: "barres",
    build: (ctx) =>
      seriesWidget(ctx, { Heures: ctx.months.map((m) => (m.hours > 0 ? round1(m.hours) : null)) }, [
        { key: "Heures", color: PP_COLORS.business },
      ]),
  },
  {
    id: "taux-horaire",
    label: "Taux horaire par mois",
    description: "CA divisé par le temps interne, pour les mois où le temps est renseigné.",
    group: "Temps",
    kind: "series",
    unit: "euro-hour",
    types: WIDGET_SERIES_TYPES,
    defaultType: "lignes",
    build: (ctx) =>
      seriesWidget(
        ctx,
        {
          "Taux horaire": ctx.months.map((m) => (m.tauxHoraire > 0 ? round(m.tauxHoraire) : null)),
        },
        [{ key: "Taux horaire", color: PP_COLORS.mid }],
      ),
  },
  {
    id: "interventions-mensuelles",
    label: "Interventions par mois",
    description: "Nombre de lignes de vente (interventions) de chaque mois.",
    group: "Temps",
    kind: "series",
    unit: "count",
    types: WIDGET_SERIES_TYPES,
    defaultType: "barres",
    build: (ctx) =>
      seriesWidget(
        ctx,
        { Interventions: ctx.interventionsByMonth.map((count) => (count > 0 ? count : null)) },
        [{ key: "Interventions", color: PP_COLORS.sales }],
      ),
  },
  {
    id: "top-clients",
    label: "Top 10 clients",
    description: "Les dix clients qui rapportent le plus sur l'année.",
    group: "Clients",
    kind: "share",
    unit: "euro",
    types: WIDGET_SHARE_TYPES,
    defaultType: "barres",
    build: (ctx) => ({
      kind: "share",
      rows: ctx.clients
        .filter((client) => client.ca > 0)
        .slice(0, 10)
        .map((client) => ({
          name:
            client.name.length > CLIENT_NAME_MAX
              ? `${client.name.slice(0, CLIENT_NAME_MAX - 1)}…`
              : client.name,
          value: round(client.ca),
        })),
    }),
  },
  {
    id: "clients-abc",
    label: "CA par classe de clients (ABC)",
    description: "Poids des clients A, B et C dans le chiffre d'affaires de l'année.",
    group: "Clients",
    kind: "share",
    unit: "euro",
    types: WIDGET_SHARE_TYPES,
    defaultType: "donut",
    build: (ctx) => ({
      kind: "share",
      rows: shareRows(
        sumBy(
          ctx.clients,
          (client) => `Classe ${client.abc}`,
          (client) => client.ca,
        ),
      ).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }),
  },
];

export function widgetById(id: string): WidgetDef | undefined {
  return DASHBOARD_WIDGETS.find((widget) => widget.id === id);
}

export function isEmptyWidgetData(data: WidgetData): boolean {
  if (data.kind === "share") return data.rows.every((row) => row.value <= 0);
  return data.rows.every((row) => data.series.every((series) => !Number(row[series.key] ?? 0)));
}

// ── Identifiants des graphiques ajoutés par l'utilisateur ─────────────────
// Format « w:<graphique>:<n> » : le même graphique peut être ajouté plusieurs fois.

export const EXTRA_PREFIX = "w:";

export function makeExtraId(widgetId: string, existing: readonly string[]): string {
  let n = 1;
  while (existing.includes(`${EXTRA_PREFIX}${widgetId}:${n}`)) n += 1;
  return `${EXTRA_PREFIX}${widgetId}:${n}`;
}

export function parseExtraId(id: string): { widgetId: string; n: number } | null {
  if (!id.startsWith(EXTRA_PREFIX)) return null;
  const [widgetId, rawN] = id.slice(EXTRA_PREFIX.length).split(":");
  const n = Number(rawN);
  if (!widgetId || !Number.isInteger(n) || n < 1) return null;
  return { widgetId, n };
}

/** Libellé d'un bloc ajouté ; undefined si le graphique n'existe plus au catalogue. */
export function extraLabel(id: string): string | undefined {
  const parsed = parseExtraId(id);
  const def = parsed ? widgetById(parsed.widgetId) : undefined;
  if (!parsed || !def) return undefined;
  return parsed.n > 1 ? `${def.label} (${parsed.n})` : def.label;
}
