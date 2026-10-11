// Génération du classeur « Backup PP CA » : un onglet « CA <année> » par exercice,
// reproduisant l'onglet « CA 2026 » du suivi mensuel (Suivi_mensuel_CA_2026.xlsx).
// Les styles (couleurs, polices, bordures, fusions, formats) sont extraits du modèle
// (pp-ca-template.json) ; aucune règle métier n'est réimplémentée : les montants viennent
// des mêmes fonctions que la page /pilot/ca (monthTotals, categoryTotals, yearTotals…).
import ExcelJS from "exceljs";
import {
  MONTH_NAMES,
  TVA_RATE,
  monthTotals,
  yearTotals,
  type CaEntry,
  type MonthTotals,
} from "@/lib/pilot-ca";
import { effectiveCategory } from "@/lib/pilot-ca-designation";
import { investmentsTotal } from "@/lib/pilot-ca-investments";
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import { hoursCounted, revenueCounted } from "@/lib/pilot-sale-accounting";
import TPL_JSON from "@/lib/pp-ca-template.json";

type Side = [string | null, string | null];
interface StyleDef {
  f: [string, number, boolean, boolean, string | null, string | null];
  fill: string | null;
  b: [Side, Side, Side, Side];
  a: [string | null, string | null, boolean, number];
  n: string;
}
interface Template {
  summary: Record<string, { s: number }>;
  blocks: Record<string, { s: number }>;
  calc: Record<string, { s: number; v?: string | number }>;
  merges: string[];
  colw: Record<string, number>;
  rowh: Record<string, number>;
  styles: StyleDef[];
}
const TPL = TPL_JSON as unknown as Template;

const FIRST_FY = 2020;

function paint(cell: ExcelJS.Cell, st: StyleDef) {
  const [name, size, bold, italic, color, underline] = st.f;
  cell.font = {
    name,
    size,
    bold,
    italic,
    ...(color ? { color: { argb: `FF${color}` } } : {}),
    ...(underline ? { underline: true } : {}),
  };
  if (st.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${st.fill}` } };
  const side = (s: Side) =>
    s[0]
      ? { style: s[0] as ExcelJS.BorderStyle, color: { argb: `FF${s[1] ?? "000000"}` } }
      : undefined;
  cell.border = {
    left: side(st.b[0]),
    right: side(st.b[1]),
    top: side(st.b[2]),
    bottom: side(st.b[3]),
  };
  const [h, v, wrap, indent] = st.a;
  cell.alignment = {
    ...(h ? { horizontal: h as ExcelJS.Alignment["horizontal"] } : {}),
    ...(v ? { vertical: (v === "center" ? "middle" : v) as ExcelJS.Alignment["vertical"] } : {}),
    wrapText: wrap,
    ...(indent ? { indent } : {}),
  };
  if (st.n && st.n !== "General") cell.numFmt = st.n;
}

export interface YearInput {
  year: number;
  entries: CaEntry[];
}
export interface BackupInput {
  /** Exercice en cours et mois courant (1-12) : bornent les moyennes de l'exercice en cours. */
  currentYear: number;
  currentMonth: number;
  years: YearInput[];
  options: AsOfOptions;
}

interface YearCtx {
  year: number;
  entries: CaEntry[];
  kept: CaEntry[];
  monthly: MonthTotals[];
  cum: number[];
  total: number;
  benefice: number;
  invest: number;
  elapsed: number;
}

type Num = number;
const f = (formula: string, result: Num | string) => ({ formula, result }) as ExcelJS.CellValue;
const sheetName = (y: number) => `CA ${y}`;
const sheetRef = (y: number) => `'${sheetName(y)}'`;

function lastMonthWithData(entries: CaEntry[]): number {
  return entries.reduce((m, e) => Math.max(m, Number(e.month) || 0), 0) || 12;
}

function buildCtx(input: BackupInput): Map<number, YearCtx> {
  const { options } = input;
  const out = new Map<number, YearCtx>();
  for (const y of input.years) {
    const kept = y.entries.filter((e) =>
      keepRealizedYearMonth(
        { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
        options,
      ),
    );
    const monthly = Array.from({ length: 12 }, (_, i) => monthTotals(y.entries, i + 1, options));
    let c = 0;
    const cum = monthly.map((m) => (c += m.ventesHt));
    const yt = yearTotals(y.entries, options);
    out.set(y.year, {
      year: y.year,
      entries: y.entries,
      kept,
      monthly,
      cum,
      total: yt.ventesHt,
      benefice: yt.benefice,
      invest: investmentsTotal(y.entries, undefined, options),
      elapsed:
        y.year === input.currentYear
          ? Math.min(12, Math.max(1, input.currentMonth))
          : lastMonthWithData(y.entries),
    });
  }
  return out;
}

function addYearSheet(
  wb: ExcelJS.Workbook,
  ctx: YearCtx,
  all: Map<number, YearCtx>,
  input: BackupInput,
) {
  const { options } = input;
  const { year, entries, kept, monthly, elapsed } = ctx;
  const prev = all.get(year - 1);
  const ws = wb.addWorksheet(sheetName(year), {
    properties: { tabColor: { argb: "FF00B0F0" }, defaultRowHeight: 15.05 },
    views: [{ zoomScale: 85 }],
  });
  const S = (id: number) => TPL.styles[id];
  const sum = (a: string) => S(TPL.summary[a].s);
  const blk = (a: string) => S(TPL.blocks[a].s);

  // ---- colonnes / hauteurs du modèle ----
  for (const [col, w] of Object.entries(TPL.colw)) ws.getColumn(col).width = w;
  for (const [r, h] of Object.entries(TPL.rowh)) ws.getRow(Number(r)).height = h;

  // ---- fond et styles de la synthèse (A1:Y29) ----
  for (const [addr, { s }] of Object.entries(TPL.summary)) paint(ws.getCell(addr), S(s));

  // ---- fusions de la synthèse ----
  const summaryMerges = TPL.merges.filter((m) => {
    const row = Number(m.match(/\d+/)?.[0]);
    return row <= 29;
  });
  for (const m of summaryMerges) ws.mergeCells(m);
  // Trimestre 4 (non encore rempli dans le modèle) : mêmes styles que le trimestre 3
  for (const [dst, src] of [
    ["K13", "K10"],
    ["K14", "K11"],
    ["K15", "K12"],
  ] as const) {
    paint(ws.getCell(dst), sum(src));
  }
  ws.mergeCells("K14:K15");

  // ---- blocs de détail ----
  const D0 = 30;
  const hdr: [string, string][] = [
    ["A", "Détails des charges"],
    ["B", "Désignation"],
    ["C", "Montant HT"],
    ["E", "Détails des ventes"],
    ["F", "Désignation"],
    ["G", "Montant HT"],
    ["H", "Temps"],
  ];
  for (const col of "ABCDEFGH") {
    paint(ws.getCell(`${col}${D0}`), blk(`${col}30`));
    paint(ws.getCell(`${col}${D0 + 1}`), blk(`${col}31`));
  }
  for (const [col, label] of hdr) ws.getCell(`${col}${D0}`).value = label;
  ws.getCell(`A${D0 + 1}`).value = "Mois";
  ws.getCell(`E${D0 + 1}`).value = "Mois";

  const chargeTotal: string[] = [];
  const saleTotal: string[] = [];
  const sapFormula: string[] = [];
  let row = D0 + 2;
  for (let m = 1; m <= 12; m++) {
    const rows = kept.filter((e) => Number(e.month) === m);
    const charges = rows.filter((e) => e.kind === "charge" && !e.is_investment);
    const ventes = rows.filter(
      (e) =>
        e.kind === "vente" &&
        (revenueCounted(e.sale_status, options) || hoursCounted(e.sale_status)),
    );
    const mt = monthly[m - 1];
    const body = Math.max(charges.length, ventes.length + 1) + 1;
    const first = row;
    const last = row + body - 1;
    const t = last + 1;
    const mois = MONTH_NAMES[m - 1];

    for (let r = first; r <= last; r++) {
      paint(ws.getCell(`D${r}`), blk("D32"));
      paint(ws.getCell(`H${r}`), blk(r === last ? "H47" : "H32"));
      ws.getRow(r).height = 15.85;
    }
    // libellés de mois (fusion verticale)
    paint(ws.getCell(`A${first}`), blk("A32"));
    paint(ws.getCell(`E${first}`), blk("E32"));
    ws.mergeCells(`A${first}:A${last}`);
    ws.mergeCells(`E${first}:E${last}`);
    ws.getCell(`A${first}`).value = mois;
    ws.getCell(`E${first}`).value = mois;

    // charges
    for (let i = 0; i < body; i++) {
      const r = first + i;
      const c = charges[i];
      const orange = c && /d[eé]ch[eè]terie/i.test(String(c.charge_category ?? ""));
      const pre = c ? (orange ? "42" : "32") : "35";
      paint(ws.getCell(`B${r}`), blk(`B${pre}`));
      paint(ws.getCell(`C${r}`), blk(`C${pre}`));
      if (c) {
        ws.getCell(`B${r}`).value = c.designation ?? "";
        ws.getCell(`C${r}`).value = Number(c.amount_ht) || 0;
      }
    }
    // ventes
    const unc: string[] = [];
    const sap: string[] = [];
    for (let i = 0; i < body; i++) {
      const r = first + i;
      const v = ventes[i];
      const isTotalRow = r === last;
      if (v) {
        paint(ws.getCell(`F${r}`), blk("F32"));
        paint(ws.getCell(`G${r}`), blk("G32"));
        const counted = revenueCounted(v.sale_status, options);
        ws.getCell(`F${r}`).value =
          `${v.designation ?? ""}${counted ? "" : " (facturé, non réglé)"}`;
        ws.getCell(`G${r}`).value = Number(v.amount_ht) || 0;
        if (!counted) unc.push(`G${r}`);
        if (effectiveCategory(v.designation, v.category) === "SAP" && counted) sap.push(`G${r}`);
        if (hoursCounted(v.sale_status) && v.hours != null) {
          ws.getCell(`H${r}`).value = Number(v.hours);
        }
      } else {
        paint(ws.getCell(`F${r}`), blk("F47"));
        paint(ws.getCell(`G${r}`), blk("G47"));
      }
      if (isTotalRow) {
        ws.getCell(`G${r}`).value = "Total temps";
        ws.getCell(`H${r}`).value = f(
          ventes.length ? `SUM(H${first}:H${last - 1})` : "0",
          mt.hours,
        );
      }
    }
    sapFormula.push(sap.length ? `SUM(${sap.join(",")})` : "0");

    // ligne de total
    for (const col of "ABCDEFGH") paint(ws.getCell(`${col}${t}`), blk(`${col}48`));
    ws.getCell(`A${t}`).value = `Total charges ${mois}`;
    ws.getCell(`C${t}`).value = f(charges.length ? `SUM(C${first}:C${last})` : "0", mt.chargesHt);
    ws.getCell(`E${t}`).value = `Total CA HT ${mois}`;
    const saleSum = ventes.length ? `SUM(G${first}:G${last - 1})` : "0";
    ws.getCell(`G${t}`).value = f(
      unc.length ? `${saleSum}-${unc.join("-")}` : saleSum,
      mt.ventesHt,
    );
    ws.getCell(`H${t}`).value = f(`IF(H${last}=0,"",G${t}/H${last})`, mt.tauxHoraire || "");
    // rémunération / prévisionnel / bénéfices
    for (const col of "ABCDEFGH") {
      paint(ws.getCell(`${col}${t + 1}`), blk(`${col}49`));
      paint(ws.getCell(`${col}${t + 2}`), blk(`${col}50`));
    }
    ws.getCell(`A${t + 1}`).value = "Rémunération";
    ws.getCell(`C${t + 1}`).value = mt.remuneration;
    ws.getCell(`F${t + 1}`).value = `Prévi CA ${mois}`;
    const previ = ventes.reduce((s, v) => s + (Number(v.amount_ht) || 0), 0);
    ws.getCell(`G${t + 1}`).value = f(ventes.length ? `SUM(G${first}:G${last - 1})` : "0", previ);
    ws.getCell(`F${t + 2}`).value = "Bénéfices";
    ws.getCell(`G${t + 2}`).value = f(`G${t}-C${t}`, mt.ventesHt - mt.chargesHt);

    chargeTotal.push(`C${t}`);
    saleTotal.push(`G${t}`);
    row = t + 3;
  }
  const lastRow = row - 1;

  // ---- calculateurs (panneau gris, colonnes I:L, comme le modèle) ----
  for (const [addr, { s, v }] of Object.entries(TPL.calc)) {
    const cell = ws.getCell(addr);
    paint(cell, S(s));
    if (v !== undefined) {
      cell.value = typeof v === "string" && v.startsWith("=") ? { formula: v.slice(1) } : v;
    }
  }
  for (const m of TPL.merges) {
    const r = Number(m.match(/\d+/)?.[0]);
    if (r >= 30) ws.mergeCells(m);
  }
  // bande bleu clair à droite (M:P), comme le modèle
  for (let r = 30; r <= lastRow; r++) {
    for (const col of ["M", "N", "O", "P"]) {
      const c = ws.getCell(`${col}${r}`);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
    }
  }

  // ---- synthèse ----
  const set = (addr: string, value: ExcelJS.CellValue) => {
    ws.getCell(addr).value = value;
  };
  set("A1", `CA ${year}`);
  set("A2", `Chiffre d'affaire ${year}`);
  set("B2", "Charges HT");
  set("C2", "CA HT");
  set("D2", "CA TTC");
  set("E2", "dont SAP HT");
  set("F2", "Bénéfices nets");
  set("G2", "Total CA HT Année");
  set("H2", "CA HT mensuel N-1");
  set("I2", "CA annuel HT N-1");
  set("J2", `Evolution CA mensuel HT ${year - 1}-${year}`);
  set("K2", "Remarques");
  set("A3", `Mois ${year}`);

  const evo: (number | null)[] = [];
  for (let m = 1; m <= 12; m++) {
    const r = m + 3;
    const mt = monthly[m - 1];
    const pm = prev?.monthly[m - 1].ventesHt ?? 0;
    const pc = prev?.cum[m - 1] ?? 0;
    const upcoming = year === input.currentYear && m > elapsed;
    const e = pm === 0 || upcoming ? null : (mt.ventesHt - pm) / pm;
    evo.push(e);
    set(`A${r}`, MONTH_NAMES[m - 1]);
    set(`B${r}`, f(chargeTotal[m - 1], mt.chargesHt));
    set(`C${r}`, f(saleTotal[m - 1], mt.ventesHt));
    set(`D${r}`, f(`C${r}*${1 + TVA_RATE}`, mt.ventesHt * (1 + TVA_RATE)));
    const sapV = rowsSap(kept, m, options);
    set(`E${r}`, f(sapFormula[m - 1], sapV));
    set(`F${r}`, f(`C${r}-B${r}`, mt.ventesHt - mt.chargesHt));
    set(`G${r}`, f(`SUM($C$4:C${r})`, ctx.cum[m - 1]));
    if (prev) {
      set(`H${r}`, f(`${sheetRef(year - 1)}!C${r}`, pm));
      set(`I${r}`, f(`${sheetRef(year - 1)}!G${r}`, pc));
    }
    // Mois à venir de l'exercice en cours : pas d'évolution (aucune donnée réalisée).
    if (year !== input.currentYear || m <= elapsed) {
      set(`J${r}`, f(`IF(H${r}=0,"",(C${r}-H${r})/H${r})`, e ?? ""));
    }
  }
  for (let q = 0; q < 4; q++) {
    const top = 4 + q * 3;
    const vals = evo.slice(q * 3, q * 3 + 3).filter((x): x is number => x != null);
    const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : "";
    set(`K${top}`, `Trimestre ${q + 1}`);
    set(`K${top + 1}`, f(`IFERROR(AVERAGE(J${top}:J${top + 2}),"")`, avg));
  }

  const lastM = 3 + elapsed;
  const el = <T>(fn: (i: number) => T) => Array.from({ length: elapsed }, (_, i) => fn(i));
  const avg = (xs: Num[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const sapAll = Array.from({ length: 12 }, (_, i) => rowsSap(kept, i + 1, options));
  set("A16", "Moyennes");
  set("B16", f(`AVERAGE(B4:B${lastM})`, avg(el((i) => monthly[i].chargesHt))));
  set("C16", f(`AVERAGE(C4:C${lastM})`, avg(el((i) => monthly[i].ventesHt))));
  set("D16", f(`AVERAGE(D4:D${lastM})`, avg(el((i) => monthly[i].ventesTtc))));
  set("E16", f(`AVERAGE(E4:E${lastM})`, avg(el((i) => sapAll[i]))));
  set("F16", f(`AVERAGE(F4:F${lastM})`, avg(el((i) => monthly[i].benefice))));
  set("G16", f(`G${lastM}`, ctx.cum[elapsed - 1] ?? 0));
  if (prev) {
    set("H16", f(`AVERAGE(H4:H${lastM})`, avg(el((i) => prev.monthly[i].ventesHt))));
    set("I16", f(`I${lastM}`, prev.cum[elapsed - 1] ?? 0));
    const sc = el((i) => monthly[i].ventesHt).reduce((s, x) => s + x, 0);
    const sp = el((i) => prev.monthly[i].ventesHt).reduce((s, x) => s + x, 0);
    set(
      "J16",
      f(`IF(SUM(H4:H${lastM})=0,"",SUM(C4:C${lastM})/SUM(H4:H${lastM})-1)`, sp ? sc / sp - 1 : ""),
    );
  }
  set("A17", "Moyenne mensuelle CA HT");
  set("B17", f(`AVERAGE(C4:C${lastM})`, avg(el((i) => monthly[i].ventesHt))));
  set("A18", "Bénéfice moyen mensuel");
  set("B18", f(`AVERAGE(F4:F${lastM})`, avg(el((i) => monthly[i].benefice))));
  const yearNo = year - (FIRST_FY - 1);
  set("A19", `CA HT Année ${yearNo} (${year})`);
  set("B19", f("SUM(C4:C15)", ctx.total));
  for (let k = 0; k < 6; k++) {
    const y = year - 1 - k;
    if (y < FIRST_FY) break;
    const r = 20 + k;
    set(`A${r}`, `CA HT Année ${y - (FIRST_FY - 1)} (${y})`);
    const c = all.get(y);
    if (c) set(`B${r}`, f(`${sheetRef(y)}!B19`, c.total));
  }
  set("A26", `Bénéfices nets Année ${yearNo}`);
  set("B26", f("SUM(F4:F15)", ctx.benefice));
  set("A27", `Investissements année ${yearNo}`);
  set("B27", ctx.invest);
  set("A28", "Bénéfices après investissements");
  set("B28", f("B26-B27", ctx.benefice - ctx.invest));
  const sapTotal = sapAll.reduce((s, x) => s + x, 0);
  set("E17", `Total SAP ${year}`);
  set("E18", f("SUM(E4:E15)", sapTotal));
  set("E23", `Total AP ${year}`);
  set("E24", f("B19-E18", ctx.total - sapTotal));

  // ---- mises en forme conditionnelles du modèle ----
  const fillCf = (argb: string) =>
    ({ fill: { type: "pattern", pattern: "solid", bgColor: { argb } } }) as Partial<ExcelJS.Style>;
  const cell = (op: "lessThan" | "greaterThan", formula: string, bg: string, font?: string) => ({
    type: "cellIs" as const,
    operator: op,
    formulae: [formula],
    priority: 1,
    style: { ...fillCf(bg), ...(font ? { font: { color: { argb: font } } } : {}) },
  });
  ws.addConditionalFormatting({
    ref: "B4:B15",
    rules: [cell("lessThan", "$B$16", "FFD7E4BD"), cell("greaterThan", "$B$16", "FFE6B9B8")],
  });
  ws.addConditionalFormatting({
    ref: "F4:F15",
    rules: [
      {
        type: "colorScale",
        priority: 2,
        cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
        color: [{ argb: "FFF8696B" }, { argb: "FFFFEB84" }, { argb: "FF63BE7B" }],
      },
    ],
  });
  ws.addConditionalFormatting({
    ref: "J4:J16",
    rules: [
      cell("lessThan", "0", "FFFFC7CE", "FF9C0006"),
      cell("greaterThan", "0", "FFC6EFCE", "FF006100"),
    ],
  });
  for (const ref of ["K5", "K8", "K11", "K14"]) {
    ws.addConditionalFormatting({
      ref,
      rules: [
        cell("lessThan", "0", "FFFFC7CE", "FF9C0006"),
        cell("greaterThan", "0", "FFC6EFCE", "FF006100"),
      ],
    });
  }
}

function rowsSap(kept: CaEntry[], month: number, options: AsOfOptions): number {
  return kept
    .filter(
      (e) =>
        Number(e.month) === month &&
        e.kind === "vente" &&
        effectiveCategory(e.designation, e.category) === "SAP" &&
        revenueCounted(e.sale_status, options),
    )
    .reduce((s, e) => s + (Number(e.amount_ht) || 0), 0);
}

export async function buildCaBackupWorkbook(input: BackupInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pilot Pro — De la graine au jardin";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  const all = buildCtx(input);
  const years = [...all.keys()].sort((a, b) => b - a); // exercice le plus récent d'abord
  for (const y of years) addYearSheet(wb, all.get(y)!, all, input);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
