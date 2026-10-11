// Génération du classeur « Backup PP CA » : un onglet « CA <année> » par exercice,
// fidèle à l'onglet « CA 2026 » du suivi mensuel (Suivi_mensuel_CA_2026.xlsx).
//
// - Mise en page : le haut de l'onglet (lignes 1-3 et 16-31) est rejoué depuis le
//   gabarit extrait du modèle (`pp-ca-backup-template.ts`) ; les lignes mensuelles,
//   les blocs de détail et les investissements sont reconstruits avec les mêmes
//   polices, couleurs, bordures, fusions et formats.
// - Aucune règle métier réimplémentée : périmètre temporel, statuts « réglé »,
//   catégories, investissements et rémunération passent par les mêmes modules que
//   la page /pilot/ca. Les totaux du classeur sont de vraies formules Excel.
import ExcelJS from "exceljs";
import { MONTH_NAMES, TVA_RATE, isRemunerationGrossed, type CaEntry } from "@/lib/pilot-ca";
import { effectiveCategory } from "@/lib/pilot-ca-designation";
import { investmentEntries } from "@/lib/pilot-ca-investments";
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import { hoursCounted, revenueCounted, saleStatusOf } from "@/lib/pilot-sale-accounting";
import { CALC_CELLS, CALC_MERGES, CALC_STYLES } from "@/lib/pp-ca-backup-calculators";
import {
  TEMPLATE_COL_WIDTHS,
  TEMPLATE_MATRIX,
  TEMPLATE_ROW_HEIGHTS,
  TEMPLATE_STYLES,
  type TemplateStyle,
} from "@/lib/pp-ca-backup-template";

// ---------------------------------------------------------------------------
// Palette du modèle (couleurs de thème déjà résolues en RGB)
// ---------------------------------------------------------------------------
const COLOR = {
  GREEN: "92D050",
  LGREEN: "D7E4BD", // thème 6 + 60 % : ligne planifiée / mois à venir
  ORANGE: "FFC000",
  SKY: "00B0F0", // sous-traitance
  YELLOW: "FFFF99", // facturé, non réglé
  INVEST: "FCD5B5", // thème 9 + 60 %
  PALE_BLUE: "DCE6F2", // thème 4 + 80 %
  PALE_GREEN: "EBF1DE", // thème 6 + 80 %
  FUTURE_MONTH: "C3D69B", // thème 6 + 40 %
  MONTH_LABEL: "E6B9B8", // thème 5 + 60 %
  TOTAL: "B3A2C7", // thème 7 + 40 %
} as const;

const EUR = '#,##0.00\\ "€"';
const EUR1 = '#,##0.0\\ "€"';
/** Lignes minimales d'un bloc mensuel (le modèle laisse des lignes libres). */
const MIN_BLOCK_LINES = 10;
const MIN_INVEST_LINES = 10;
const LINE_HEIGHT = 15.05;

const mk = (o: Partial<TemplateStyle>): TemplateStyle => ({ sz: 11, fc: "000000", ...o });

// ---------------------------------------------------------------------------
// Modèle de données (pur, sans ExcelJS) — réutilisé par les tests
// ---------------------------------------------------------------------------
export interface SaleLine {
  designation: string;
  amount: number;
  hours: number | null;
  status: "planifie" | "realise" | "regle" | "particulier";
  /** CA comptabilisé (règle PP : réglé). */
  counted: boolean;
  /** Temps comptabilisé (règle PP : dès facturé). */
  hoursCounted: boolean;
  sap: boolean;
  note: string | null;
}

export interface ChargeLine {
  designation: string;
  amount: number;
  fill: string;
  note: string | null;
}

export interface MonthModel {
  month: number;
  charges: ChargeLine[];
  sales: SaleLine[];
  /** Rémunération nette du mois (null si aucune ligne). */
  remuNet: number | null;
  chargesTotal: number;
  caHt: number;
  sapHt: number;
  hours: number;
  /** Prévisionnel : toutes les lignes de vente du mois, tous statuts confondus. */
  forecast: number;
}

export interface YearModel {
  year: number;
  /** Mois écoulés dont les moyennes tiennent compte (12 pour un exercice clos). */
  elapsed: number;
  months: MonthModel[];
  investments: { designation: string; amount: number; note: string | null }[];
  investmentsTotal: number;
  caTotal: number;
  chargesTotal: number;
  benefice: number;
}

export interface BackupInput {
  /** Une entrée par exercice existant (ordre indifférent). */
  years: { year: number; entries: CaEntry[] }[];
  /** Périmètre commun à toute la page : « à date » par défaut. */
  options: AsOfOptions;
  /** Année et mois courants (Paris). */
  today: { year: number; month: number };
}

const TECHNICAL_NOTE = /^histo_/i;
const usefulNote = (note: string | null | undefined): string | null => {
  const n = (note ?? "").trim();
  return n && !TECHNICAL_NOTE.test(n) ? n : null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Couleur d'une ligne de charge (convention du modèle). */
function chargeFill(e: CaEntry): string {
  if (saleStatusOf(e.sale_status) === "planifie") return COLOR.LGREEN;
  const label = norm(e.designation);
  if (norm(e.charge_category).includes("decheterie") || label.includes("decheterie")) {
    return COLOR.ORANGE;
  }
  if (/^(sst|sous[\s-]?trait|ss[\s-]?trait)/.test(label)) return COLOR.SKY;
  return COLOR.GREEN;
}

const saleFill = (s: SaleLine): string =>
  s.status === "planifie" ? COLOR.LGREEN : s.counted ? COLOR.GREEN : COLOR.YELLOW;

export function elapsedMonths(year: number, today: { year: number; month: number }): number {
  if (year < today.year) return 12;
  if (year === today.year) return Math.min(12, Math.max(1, today.month));
  return 0;
}

export function buildYearModel(
  year: number,
  entries: CaEntry[],
  options: AsOfOptions,
  today: { year: number; month: number },
): YearModel {
  const kept = entries.filter((e) =>
    keepRealizedYearMonth(
      { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
      options,
    ),
  );
  const months: MonthModel[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const rows = kept.filter((e) => Number(e.month) === month);
    const charges: ChargeLine[] = rows
      .filter((e) => e.kind === "charge" && !e.is_investment)
      .map((e) => ({
        designation: e.designation ?? "",
        amount: Number(e.amount_ht) || 0,
        fill: chargeFill(e),
        note: usefulNote(e.note),
      }));
    const sales: SaleLine[] = rows
      .filter((e) => e.kind === "vente")
      .map((e) => ({
        designation: e.designation ?? "",
        amount: Number(e.amount_ht) || 0,
        hours: e.hours == null ? null : Number(e.hours) || 0,
        status: saleStatusOf(e.sale_status),
        counted: revenueCounted(e.sale_status, options),
        hoursCounted: hoursCounted(e.sale_status),
        sap: effectiveCategory(e.designation, e.category) === "SAP",
        note: usefulNote(e.note),
      }));
    const remus = rows.filter((e) => e.kind === "remuneration");
    const remuNet = remus.length
      ? remus.reduce(
          (s, r) =>
            s +
            (Number(r.net_amount_ht ?? (isRemunerationGrossed(year, month) ? 0 : r.amount_ht)) ||
              0),
          0,
        )
      : null;
    const caHt = sales.reduce((s, l) => s + (l.counted ? l.amount : 0), 0);
    return {
      month,
      charges,
      sales,
      remuNet,
      chargesTotal: charges.reduce((s, l) => s + l.amount, 0),
      caHt,
      sapHt: sales.reduce((s, l) => s + (l.counted && l.sap ? l.amount : 0), 0),
      hours: sales.reduce((s, l) => s + (l.hoursCounted ? (l.hours ?? 0) : 0), 0),
      forecast: sales.reduce((s, l) => s + l.amount, 0),
    };
  });
  const investments = investmentEntries(entries, undefined, options).map((e) => ({
    designation: e.designation ?? "",
    amount: Number(e.amount_ht) || 0,
    note: usefulNote(e.note),
  }));
  const caTotal = months.reduce((s, m) => s + m.caHt, 0);
  const chargesTotal = months.reduce((s, m) => s + m.chargesTotal, 0);
  return {
    year,
    elapsed: elapsedMonths(year, today),
    months,
    investments,
    investmentsTotal: investments.reduce((s, i) => s + i.amount, 0),
    caTotal,
    chargesTotal,
    benefice: caTotal - chargesTotal,
  };
}

// ---------------------------------------------------------------------------
// Aides ExcelJS
// ---------------------------------------------------------------------------
type Formula = { formula: string; result: number | string };
const f = (formula: string, result: number | string): Formula => ({ formula, result });

const BORDER_KEYS = ["left", "right", "top", "bottom"] as const;
function bordersOf(code: string): Partial<ExcelJS.Borders> {
  const out: Partial<ExcelJS.Borders> = {};
  BORDER_KEYS.forEach((side, i) => {
    const c = code[i];
    if (c === "t" || c === "m") {
      out[side] = { style: c === "t" ? "thin" : "medium", color: { argb: "FF000000" } };
    }
  });
  return out;
}

function applyStyle(cell: ExcelJS.Cell, d: TemplateStyle): void {
  cell.font = {
    name: "Calibri",
    size: d.sz,
    bold: !!d.b,
    italic: !!d.i,
    color: { argb: `FF${d.fc}` },
  };
  if (d.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${d.fill}` } };
  if (d.bd) cell.border = bordersOf(d.bd);
  const alignment: Partial<ExcelJS.Alignment> = {};
  if (d.h) alignment.horizontal = d.h;
  if (d.v) alignment.vertical = d.v === "center" ? "middle" : d.v;
  if (d.w) alignment.wrapText = true;
  if (Object.keys(alignment).length) cell.alignment = alignment;
  if (d.nf) cell.numFmt = d.nf;
}

const COLS = "ABCDEFGHIJKL";

/** Plages consécutives d'une liste de numéros de ligne triée. */
function ranges(rows: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last[1] === r - 1) last[1] = r;
    else out.push([r, r]);
  }
  return out;
}

/** « SUM(G33:G34,G36) » ou null s'il n'y a aucune ligne. */
function sumOf(col: string, rows: number[]): string | null {
  if (!rows.length) return null;
  const parts = ranges(rows).map(([a, b]) => (a === b ? `${col}${a}` : `${col}${a}:${col}${b}`));
  return `SUM(${parts.join(",")})`;
}

const sheetName = (year: number) => `CA ${year}`;
const yearRank = (year: number, firstYear: number) => year - firstYear + 1;

// ---------------------------------------------------------------------------
// Styles propres au haut de l'onglet (lignes 4-15) et aux blocs mensuels
// ---------------------------------------------------------------------------
const S = {
  monthName: (fill: string) => mk({ b: 1, fill, bd: "tttt", h: "left", v: "center" }),
  cell: (fill: string, nf: string, extra: Partial<TemplateStyle> = {}) =>
    mk({ fill, bd: "tttt", h: "center", v: "center", nf, ...extra }),
  pendingQuarter: mk({ fill: COLOR.GREEN, bd: "tttt", h: "center", v: "center" }),
  quarterLabel: mk({ b: 1, fill: COLOR.PALE_BLUE, bd: "tttt", h: "center", v: "center" }),
  quarterAvg: (nf: string) =>
    mk({ b: 1, fill: COLOR.PALE_BLUE, bd: "tttt", h: "center", v: "center", nf }),
  labelA: mk({ sz: 14, b: 1, fill: COLOR.MONTH_LABEL, bd: "mmmm", h: "center", v: "center" }),
  labelE: mk({ sz: 14, b: 1, fill: COLOR.GREEN, bd: "mmmm", h: "center", v: "center" }),
  line: (fill: string, nf?: string) =>
    mk({ fill, bd: "tttt", h: "center", v: "center", ...(nf ? { nf } : {}) }),
  hours: mk({ fill: COLOR.PALE_BLUE, bd: "nmnn", h: "center", v: "center" }),
  spacer: mk({ fill: COLOR.PALE_BLUE }),
  tempsFiller: mk({ fill: COLOR.LGREEN, bd: "tttn", h: "center", v: "center" }),
  tempsLabel: mk({ b: 1, fill: COLOR.LGREEN, bd: "tttn", h: "center", v: "center" }),
  tempsTotal: mk({
    b: 1,
    fill: COLOR.PALE_BLUE,
    bd: "tmtn",
    h: "center",
    v: "center",
    nf: EUR1.replace(/\\ "€"/, ""),
  }),
  totalText: (bd: string) => mk({ b: 1, fill: COLOR.TOTAL, bd, h: "left", v: "center" }),
  totalFill: (bd: string) => mk({ b: 1, fill: COLOR.TOTAL, bd }),
  totalAmount: (bd: string) =>
    mk({ b: 1, fill: COLOR.TOTAL, bd, h: "center", v: "center", nf: EUR }),
  orange: mk({ fill: COLOR.ORANGE, v: "center" }),
  orangeLeft: mk({ fill: COLOR.ORANGE, h: "left", v: "center" }),
  orangeCenter: mk({ fill: COLOR.ORANGE, h: "center", v: "center" }),
  orangeBig: mk({ sz: 14, b: 1, fill: COLOR.ORANGE, h: "center", v: "center" }),
  orangeAmount: mk({ fill: COLOR.ORANGE, h: "center", v: "center", nf: EUR }),
  investHeader: mk({ b: 1, bd: "tttt", h: "center", v: "center" }),
  investLine: (fill?: string, nf?: string) =>
    mk({ ...(fill ? { fill } : {}), bd: "tttt", h: "center", v: "center", ...(nf ? { nf } : {}) }),
  investTotal: mk({ b: 1, bd: "tttt", h: "center", v: "center", nf: EUR }),
};

// ---------------------------------------------------------------------------
// Classeur
// ---------------------------------------------------------------------------
export async function buildCaBackupWorkbook(input: BackupInput): Promise<ArrayBuffer> {
  const { options, today } = input;
  const sorted = [...input.years].sort((a, b) => a.year - b.year);
  if (!sorted.length) throw new Error("Aucun exercice à sauvegarder");
  const firstYear = sorted[0].year;
  const models = new Map<number, YearModel>(
    sorted.map(({ year, entries }) => [year, buildYearModel(year, entries, options, today)]),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pilot Pro — De la graine au jardin";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  // Onglets : exercice courant en premier, puis du plus récent au plus ancien.
  for (const { year } of [...sorted].reverse()) {
    writeYearSheet(wb, models.get(year)!, models, firstYear, today);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

function writeYearSheet(
  wb: ExcelJS.Workbook,
  model: YearModel,
  models: Map<number, YearModel>,
  firstYear: number,
  today: { year: number; month: number },
): void {
  const { year } = model;
  const prev = models.get(year - 1) ?? null;
  const ws = wb.addWorksheet(sheetName(year), {
    properties: year === today.year ? { tabColor: { argb: "FF00B0F0" } } : {},
    views: [{ zoomScale: 85, zoomScaleNormal: 85 }],
    pageSetup: { paperSize: 9, orientation: "portrait" },
  });
  const n = model.elapsed;
  const lastAvgRow = 3 + Math.max(n, 1);

  // Colonnes (largeurs du modèle)
  for (const [letter, width] of Object.entries(TEMPLATE_COL_WIDTHS)) {
    ws.getColumn(letter).width = width;
  }

  const set = (addr: string, value: ExcelJS.CellValue, style?: TemplateStyle): ExcelJS.Cell => {
    const cell = ws.getCell(addr);
    if (style) applyStyle(cell, style);
    cell.value = value;
    return cell;
  };

  // ---- Gabarit du modèle : lignes 1-3 et 16-31 --------------------------------
  const templateRow = (row: number) => {
    const ids = TEMPLATE_MATRIX[row - 1];
    for (let c = 0; c < COLS.length; c++) {
      const id = ids[c];
      if (id >= 0) applyStyle(ws.getCell(`${COLS[c]}${row}`), TEMPLATE_STYLES[id]);
    }
    const h = TEMPLATE_ROW_HEIGHTS[row - 1];
    if (h) ws.getRow(row).height = h;
  };
  for (const r of [1, 2, 3]) templateRow(r);
  for (let r = 16; r <= 31; r++) templateRow(r);

  // ---- Ligne 1-3 : titres ------------------------------------------------------
  ws.mergeCells("A1:L1");
  ws.getCell("A1").value = `CA ${year}`;
  const headers = [
    `Chiffre d'affaire ${year}`,
    "Charges HT",
    "CA HT",
    "CA TTC",
    "dont SAP HT",
    "Bénéfices nets",
    "Total CA HT Année",
    "CA HT mensuel N-1",
    "CA annuel HT N-1",
    `Evolution CA mensuel HT ${year - 1}-${year}`,
    "Remarques",
  ];
  headers.forEach((h, i) => {
    ws.getCell(`${COLS[i]}2`).value = h;
  });
  for (const col of "BCDEFGHIJ") ws.mergeCells(`${col}2:${col}3`);
  ws.getCell("A3").value = `Mois ${year}`;

  // ---- Détails (ligne 30 et suivantes) : calculés avant le résumé (références) ----
  ws.getCell("A30").value = "Détails des charges";
  ws.getCell("B30").value = "Désignation";
  ws.getCell("C30").value = "Montant HT";
  ws.getCell("E30").value = "Détails des ventes";
  ws.getCell("F30").value = "Désignation";
  ws.getCell("G30").value = "Montant HT";
  ws.getCell("H30").value = "Temps";
  ws.getCell("A31").value = "Mois";
  ws.getCell("E31").value = "Mois";

  interface BlockRefs {
    chargesTotalRow: number;
    caTotalRow: number;
    sapFormula: string | null;
  }
  const refs: BlockRefs[] = [];
  let row = 32;
  for (const m of model.months) {
    const L = Math.max(m.charges.length, m.sales.length, MIN_BLOCK_LINES);
    const s = row; // première ligne
    const lastLine = s + L - 1;
    const t = s + L; // « Total temps »
    const T = t + 1; // totaux
    const R = T + 1; // rémunération / prévisionnel
    const B = R + 1; // bénéfices
    const name = MONTH_NAMES[m.month - 1];
    const future = year === today.year && m.month > today.month;

    for (let r = s; r <= B; r++) ws.getRow(r).height = r === T ? 15.85 : LINE_HEIGHT;

    // Libellés de mois fusionnés (A et E), du premier rang jusqu'à « Total temps »
    set(`A${s}`, name, S.labelA);
    set(`E${s}`, name, S.labelE);
    ws.mergeCells(`A${s}:A${t}`);
    ws.mergeCells(`E${s}:E${t}`);

    for (let i = 0; i < L; i++) {
      const r = s + i;
      const c = m.charges[i];
      const v = m.sales[i];
      const cf = future ? COLOR.LGREEN : (c?.fill ?? COLOR.LGREEN);
      const designation = set(`B${r}`, c ? c.designation : null, S.line(c ? cf : COLOR.LGREEN));
      if (c?.note) designation.note = c.note;
      set(`C${r}`, c ? c.amount : null, S.line(c ? cf : COLOR.LGREEN, EUR));
      set(`D${r}`, null, S.spacer);
      const vf = v ? saleFill(v) : COLOR.LGREEN;
      const sd = set(`F${r}`, v ? v.designation : null, S.line(vf));
      if (v?.note) sd.note = v.note;
      set(`G${r}`, v ? v.amount : null, { ...S.line(vf, EUR), bd: "tmtt" });
      set(`H${r}`, v?.hours ?? null, S.hours);
    }

    // Total temps
    set(`B${t}`, null, S.tempsFiller);
    set(`C${t}`, null, S.tempsFiller);
    set(`D${t}`, null, S.spacer);
    set(`F${t}`, null, S.tempsFiller);
    set(`G${t}`, "Total temps", S.tempsLabel);
    const hourRows = m.sales.flatMap((l, i) => (l.hoursCounted && l.hours != null ? [s + i] : []));
    const hoursFormula = sumOf("H", hourRows);
    set(`H${t}`, hoursFormula ? f(hoursFormula, m.hours) : 0, S.tempsTotal);

    // Totaux
    set(`A${T}`, `Total charges ${name}`, S.totalText("mnmm"));
    set(`B${T}`, null, S.totalFill("nnmm"));
    set(`C${T}`, f(`SUM(C${s}:C${lastLine})`, m.chargesTotal), S.totalAmount("nmmm"));
    set(`D${T}`, null, S.spacer);
    set(`E${T}`, `Total CA HT ${name}`, S.totalText("mnmm"));
    set(`F${T}`, null, S.totalFill("nnmm"));
    const caRows = m.sales.flatMap((l, i) => (l.counted ? [s + i] : []));
    const caFormula = sumOf("G", caRows);
    set(`G${T}`, caFormula ? f(caFormula, m.caHt) : 0, S.totalAmount("nnmm"));
    set(
      `H${T}`,
      f(`IF(H${t}=0,"",G${T}/H${t})`, m.hours > 0 ? m.caHt / m.hours : ""),
      S.totalAmount("nmmm"),
    );

    // Rémunération / prévisionnel
    set(`A${R}`, "Rémunération", S.orangeLeft);
    set(`B${R}`, null, S.orange);
    set(`C${R}`, m.remuNet, S.orangeAmount);
    set(`D${R}`, null, S.spacer);
    set(`E${R}`, null, S.orange);
    set(`F${R}`, `Prévi CA ${name}`, S.orangeLeft);
    set(`G${R}`, f(`SUM(G${s}:G${lastLine})`, m.forecast), S.orangeAmount);
    set(`H${R}`, null, S.spacer);

    // Bénéfices
    set(`A${B}`, null, S.orangeBig);
    set(`B${B}`, null, S.orange);
    set(`C${B}`, null, S.orangeAmount);
    set(`D${B}`, null, S.spacer);
    set(`E${B}`, null, S.orangeBig);
    set(`F${B}`, "Bénéfices", S.orangeCenter);
    set(`G${B}`, f(`G${T}-C${T}`, m.caHt - m.chargesTotal), S.orangeAmount);
    set(`H${B}`, null, S.spacer);

    const sapRows = m.sales.flatMap((l, i) => (l.counted && l.sap ? [s + i] : []));
    refs.push({ chargesTotalRow: T, caTotalRow: T, sapFormula: sumOf("G", sapRows) });
    row = B + 1;
  }

  // ---- Panneau « Calculateurs » du modèle (colonnes I-L, lignes 30-90) ------------
  for (const [r, c, sid, v] of CALC_CELLS) {
    const cell = ws.getCell(`${c}${r}`);
    applyStyle(cell, CALC_STYLES[sid]);
    if (v !== undefined) {
      cell.value = typeof v === "object" ? { formula: v.f } : v;
    }
  }
  for (const range of CALC_MERGES) ws.mergeCells(range);

  // ---- Achats à affecter au résultat (investissements) ---------------------------
  const invHeader = row + 1;
  ws.mergeCells(`A${invHeader}:B${invHeader}`);
  set(`A${invHeader}`, `Achats à affecter au résultat ${year}`, S.investHeader);
  set(`B${invHeader}`, null, S.investHeader);
  const invLines = Math.max(model.investments.length, MIN_INVEST_LINES);
  for (let i = 0; i < invLines; i++) {
    const r = invHeader + 1 + i;
    const inv = model.investments[i];
    const a = set(
      `A${r}`,
      inv ? inv.designation : null,
      S.investLine(inv ? COLOR.GREEN : undefined),
    );
    if (inv?.note) a.note = inv.note;
    set(`B${r}`, inv ? inv.amount : null, S.investLine(inv ? COLOR.GREEN : undefined, EUR));
  }
  const invTotalRow = invHeader + 1 + invLines;
  set(`A${invTotalRow}`, `Sous-total I ${year}`, S.investLine());
  set(
    `B${invTotalRow}`,
    f(`SUM(B${invHeader + 1}:B${invTotalRow - 1})`, model.investmentsTotal),
    S.investTotal,
  );
  for (let r = invHeader; r <= invTotalRow; r++) ws.getRow(r).height = LINE_HEIGHT;

  // ---- Résumé mensuel (lignes 4-15) ----------------------------------------------
  const prevName = prev ? `'${sheetName(year - 1)}'` : null;
  let prevCumul = 0;
  const evolution: (number | "")[] = [];
  let cumul = 0;
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const cols: Record<string, number[]> = { B: [], C: [], D: [], E: [], F: [], G: [], H: [] };
  for (const m of model.months) {
    const r = 3 + m.month;
    const ref = refs[m.month - 1];
    const closed = year < today.year || (year === today.year && m.month < today.month);
    const futureMonth = year === today.year && m.month > today.month;
    const base = closed ? COLOR.PALE_BLUE : COLOR.PALE_GREEN;
    const prevMonth = prev?.months[m.month - 1];
    prevCumul += prevMonth?.caHt ?? 0;
    cumul += m.caHt;

    set(
      `A${r}`,
      MONTH_NAMES[m.month - 1],
      S.monthName(futureMonth ? COLOR.FUTURE_MONTH : COLOR.PALE_BLUE),
    );
    set(`B${r}`, f(`C${ref.chargesTotalRow}`, m.chargesTotal), S.cell(COLOR.PALE_GREEN, EUR));
    set(`C${r}`, f(`G${ref.caTotalRow}`, m.caHt), S.cell(base, EUR));
    set(`D${r}`, f(`C${r}*${1 + TVA_RATE}`, m.caHt * (1 + TVA_RATE)), S.cell(base, EUR));
    set(`E${r}`, ref.sapFormula ? f(ref.sapFormula, m.sapHt) : 0, S.cell(base, EUR));
    set(
      `F${r}`,
      f(`C${r}-B${r}`, m.caHt - m.chargesTotal),
      S.cell(COLOR.PALE_GREEN, EUR, { b: 1 }),
    );
    set(`G${r}`, f(`SUM(C4:C${r})`, cumul), S.cell(base, EUR));
    if (prevName) {
      set(`H${r}`, f(`${prevName}!C${r}`, prevMonth?.caHt ?? 0), S.cell(COLOR.PALE_BLUE, EUR1));
      set(`I${r}`, f(`${prevName}!G${r}`, prevCumul), S.cell(COLOR.PALE_BLUE, EUR));
    } else {
      set(`H${r}`, null, S.cell(COLOR.PALE_BLUE, EUR1));
      set(`I${r}`, null, S.cell(COLOR.PALE_BLUE, EUR));
    }
    const elapsed = m.month <= n;
    const prevCa = prevMonth?.caHt ?? 0;
    if (prevName && elapsed) {
      const value = prevCa === 0 ? "" : (m.caHt - prevCa) / prevCa;
      set(
        `J${r}`,
        f(`IF(H${r}=0,"",(C${r}-H${r})/H${r})`, value),
        S.cell(COLOR.PALE_BLUE, "0.00%"),
      );
      evolution.push(value);
    } else {
      set(`J${r}`, null, S.cell(COLOR.PALE_BLUE, m.month === 1 ? "0.00%" : "0%"));
      evolution.push("");
    }
    if (m.month <= n) {
      cols.B.push(m.chargesTotal);
      cols.C.push(m.caHt);
      cols.D.push(m.caHt * (1 + TVA_RATE));
      cols.E.push(m.sapHt);
      cols.F.push(m.caHt - m.chargesTotal);
      cols.G.push(cumul);
    }
  }

  // Trimestres (colonne K) : libellé puis moyenne de l'évolution, cellules fusionnées
  for (let q = 0; q < 4; q++) {
    const top = 4 + q * 3;
    if (q === 3 && n < 12) {
      // Trimestre non terminé : zone laissée vide en vert, comme dans le modèle.
      for (let r = top; r < top + 3; r++) set(`K${r}`, null, S.pendingQuarter);
      continue;
    }
    set(`K${top}`, `Trimestre ${q + 1}`, S.quarterLabel);
    const nf = q === 0 ? "0.00%" : "0.0%";
    const nums = evolution.slice(q * 3, q * 3 + 3).filter((v): v is number => v !== "");
    ws.mergeCells(`K${top + 1}:K${top + 2}`);
    set(
      `K${top + 1}`,
      f(`IFERROR(AVERAGE(J${top}:J${top + 2}),"")`, nums.length ? avg(nums) : ""),
      S.quarterAvg(nf),
    );
    set(`K${top + 2}`, null, S.quarterAvg(nf));
  }

  // ---- Moyennes et synthèse annuelle (lignes 16-28) --------------------------------
  const evolNums = evolution.filter((v): v is number => v !== "");
  ws.getCell("A16").value = "Moyennes";
  const avgRow = (col: string, vals: number[]) => {
    if (!vals.length) return;
    ws.getCell(`${col}16`).value = f(`AVERAGE(${col}4:${col}${lastAvgRow})`, avg(vals));
  };
  for (const c of ["B", "C", "D", "E", "F", "G"]) avgRow(c, cols[c]);
  if (prevName) {
    ws.getCell("H16").value = f("AVERAGE(H4:H15)", avg(prev!.months.map((pm) => pm.caHt)));
    ws.getCell("I16").value = f(`${prevName}!G15`, prev!.caTotal);
    ws.getCell("J16").value = f(
      `IFERROR(AVERAGE(J4:J15),"")`,
      evolNums.length ? avg(evolNums) : "",
    );
  }
  ws.getCell("A17").value = "Moyenne mensuelle CA HT";
  if (cols.C.length) {
    ws.getCell("B17").value = f(`AVERAGE(C4:C${lastAvgRow})`, avg(cols.C));
  }
  ws.getCell("E17").value = `Total SAP ${year}`;
  ws.getCell("A18").value = "Bénéfice moyen mensuel";
  if (cols.F.length) {
    ws.getCell("B18").value = f(`AVERAGE(F4:F${lastAvgRow})`, avg(cols.F));
  }
  const sapTotal = model.months.reduce((s, m) => s + m.sapHt, 0);
  ws.getCell("E18").value = f("SUM(E4:E15)", sapTotal);

  const rank = yearRank(year, firstYear);
  ws.getCell("A19").value = `CA HT Année ${rank} (${year})`;
  ws.getCell("B19").value = f("SUM(C4:C15)", model.caTotal);
  for (let i = 0; i < 6; i++) {
    const y = year - 1 - i;
    const ym = models.get(y);
    const r = 20 + i;
    if (!ym) continue;
    ws.getCell(`A${r}`).value = `CA HT Année ${yearRank(y, firstYear)} (${y})`;
    ws.getCell(`B${r}`).value = f(`${sheetName(y) && `'${sheetName(y)}'`}!B19`, ym.caTotal);
  }
  ws.getCell("E23").value = `Total AP ${year}`;
  ws.getCell("E24").value = f("B19-E18", model.caTotal - sapTotal);
  ws.getCell("A26").value = `Bénéfices nets Année ${rank}`;
  ws.getCell("B26").value = f("SUM(F4:F15)", model.benefice);
  ws.getCell("A27").value = `Investissements année ${rank}`;
  ws.getCell("B27").value = f(`B${invTotalRow}`, model.investmentsTotal);
  ws.getCell("A28").value = "Bénéfices après investissements";
  ws.getCell("B28").value = f("B26-B27", model.benefice - model.investmentsTotal);

  // ---- Mises en forme conditionnelles du modèle ------------------------------------
  const solid = (argb: string): ExcelJS.Fill => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
    bgColor: { argb },
  });
  const goodStyle = { font: { color: { argb: "FF006100" } }, fill: solid("FFC6EFCE") };
  const badStyle = { font: { color: { argb: "FF9C0006" } }, fill: solid("FFFFC7CE") };
  ws.addConditionalFormatting({
    ref: "B4:B15",
    rules: [
      {
        type: "cellIs",
        operator: "lessThan",
        formulae: ["$B$16"],
        priority: 20,
        style: { fill: solid(`FF${COLOR.LGREEN}`) },
      },
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: ["$B$16"],
        priority: 21,
        style: { fill: solid(`FF${COLOR.MONTH_LABEL}`) },
      },
    ],
  });
  ws.addConditionalFormatting({
    ref: "F4:F15",
    rules: [
      {
        type: "colorScale",
        priority: 22,
        cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
        color: [{ argb: "FFF8696B" }, { argb: "FFFFEB84" }, { argb: "FF63BE7B" }],
      },
    ],
  });
  for (const ref of ["J4:J15", "K5", "K8", "K11", ...(n >= 12 ? ["K14"] : [])]) {
    ws.addConditionalFormatting({
      ref,
      rules: [
        { type: "cellIs", operator: "lessThan", formulae: ["0"], priority: 24, style: badStyle },
        {
          type: "cellIs",
          operator: "greaterThan",
          formulae: ["0"],
          priority: 23,
          style: goodStyle,
        },
      ],
    });
  }
}
