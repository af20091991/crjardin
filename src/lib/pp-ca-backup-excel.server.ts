// Génération du classeur « Backup PP CA », fidèle à l'onglet « CA <année> » du
// suivi mensuel. Aucune règle métier réimplémentée : les montants viennent des
// mêmes fonctions que la page /pilot/ca (monthTotals, categoryTotals,
// investmentsTotal, yearTotals, revenueCounted, hoursCounted).
import ExcelJS from "exceljs";
import {
  MONTH_NAMES,
  TVA_RATE,
  categoryTotals,
  monthTotals,
  yearTotals,
  type CaEntry,
} from "@/lib/pilot-ca";
import { investmentsTotal } from "@/lib/pilot-ca-investments";
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import { hoursCounted, revenueCounted } from "@/lib/pilot-sale-accounting";

const BLUE = "FF0F9DE8";
const GREEN = "FF92D050";
const ORANGE = "FFFFC000";
const WHITE = "FFFFFFFF";
const EUR = '#,##0.00\\ "€"';
const EUR1 = '#,##0.0\\ "€"';
const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const FONT = { name: "Calibri", size: 11 };

export interface BackupInput {
  year: number;
  /** Mois écoulés de l'exercice (1-12) : sert aux moyennes. */
  monthsElapsed: number;
  entries: CaEntry[];
  previousEntries: CaEntry[];
  /** Totaux annuels des exercices antérieurs (du plus ancien au plus récent). */
  history: { year: number; ventesHt: number; benefice: number }[];
  options: AsOfOptions;
}

type Num = number;

function fillOf(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export async function buildCaBackupWorkbook(input: BackupInput): Promise<ArrayBuffer> {
  const { year, monthsElapsed, entries, previousEntries, history, options } = input;
  const n = Math.min(12, Math.max(1, monthsElapsed));
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pilot Pro — De la graine au jardin";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  const ws = wb.addWorksheet(`CA ${year}`);

  [28, 22, 12, 13.4, 25.6, 25.3, 16.6, 17, 31.9, 22.2, 15.8, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // ---------- helpers ----------
  const put = (
    addr: string,
    value: ExcelJS.CellValue,
    o: {
      fmt?: string;
      bold?: boolean;
      fill?: string;
      color?: string;
      center?: boolean;
      border?: boolean;
    } = {},
  ) => {
    const c = ws.getCell(addr);
    c.value = value;
    c.font = { ...FONT, bold: !!o.bold, ...(o.color ? { color: { argb: o.color } } : {}) };
    if (o.fmt) c.numFmt = o.fmt;
    if (o.fill) c.fill = fillOf(o.fill);
    if (o.center) c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (o.border !== false) c.border = BORDER;
    return c;
  };
  const f = (formula: string, result: Num | string) => ({ formula, result }) as ExcelJS.CellValue;

  // ---------- données (mêmes règles que la page) ----------
  const keep = (e: CaEntry) =>
    keepRealizedYearMonth(
      { year: Number(e.year), month: Number(e.month), entry_date: e.entry_date },
      options,
    );
  const kept = entries.filter(keep);
  const monthly = Array.from({ length: 12 }, (_, i) => monthTotals(entries, i + 1, options));
  const prevMonthly = Array.from({ length: 12 }, (_, i) =>
    monthTotals(previousEntries, i + 1, options),
  );
  const sapByMonth = Array.from(
    { length: 12 },
    (_, i) => categoryTotals(kept, i + 1, options).find((c) => c.category === "SAP")?.ht ?? 0,
  );
  const yt = yearTotals(entries, options);
  const invest = investmentsTotal(entries, undefined, options);

  // ---------- Détails (à partir de la ligne 30, ou plus bas si l'historique est long) ----------
  const histRows = history.length;
  const lastLeftRow = 19 + histRows + 3; // A19 + historique + 3 lignes de bénéfices
  const D0 = Math.max(30, lastLeftRow + 2);
  put(`A${D0}`, "Détails des charges", { bold: true });
  put(`B${D0}`, "Désignation", { bold: true });
  put(`C${D0}`, "Montant HT", { bold: true });
  put(`E${D0}`, "Détails des ventes", { bold: true });
  put(`F${D0}`, "Désignation", { bold: true });
  put(`G${D0}`, "Montant HT", { bold: true });
  put(`H${D0}`, "Temps", { bold: true });
  put(`A${D0 + 1}`, "Mois", { bold: true, fill: ORANGE });
  put(`E${D0 + 1}`, "Mois", { bold: true, fill: ORANGE });

  const chargeTotalRef: string[] = [];
  const saleTotalRef: string[] = [];
  let row = D0 + 2;
  for (let m = 1; m <= 12; m++) {
    const rows = kept.filter((e) => Number(e.month) === m);
    const charges = rows.filter((e) => e.kind === "charge" && !e.is_investment);
    const ventes = rows.filter(
      (e) =>
        e.kind === "vente" &&
        (revenueCounted(e.sale_status, options) || hoursCounted(e.sale_status)),
    );
    const height = Math.max(charges.length, ventes.length, 1);
    const first = row;
    const last = row + height - 1;
    for (const col of ["A", "E"]) {
      ws.mergeCells(`${col}${first}:${col}${last}`);
      put(`${col}${first}`, MONTH_NAMES[m - 1], { bold: true, fill: GREEN, center: true });
    }
    for (let i = 0; i < height; i++) {
      const r = first + i;
      const c = charges[i];
      put(`B${r}`, c ? (c.designation ?? "") : null, { fill: c ? GREEN : undefined });
      put(`C${r}`, c ? Number(c.amount_ht) || 0 : null, { fmt: EUR, fill: c ? GREEN : undefined });
      const v = ventes[i];
      const counted = v ? revenueCounted(v.sale_status, options) : false;
      put(`F${r}`, v ? `${v.designation ?? ""}${counted ? "" : " (facturé, non réglé)"}` : null, {
        fill: v ? GREEN : undefined,
      });
      put(`G${r}`, v ? (counted ? Number(v.amount_ht) || 0 : 0) : null, {
        fmt: EUR,
        fill: v ? GREEN : undefined,
      });
      put(`H${r}`, v && hoursCounted(v.sale_status) && v.hours != null ? Number(v.hours) : null, {
        fmt: "0.00",
      });
    }
    const t = last + 1;
    const hasC = charges.length > 0;
    const hasV = ventes.length > 0;
    put(`B${t}`, "Total charges", { bold: true });
    put(`C${t}`, f(hasC ? `SUM(C${first}:C${last})` : "0", monthly[m - 1].chargesHt), {
      fmt: EUR,
      bold: true,
    });
    put(`F${t}`, "Total ventes", { bold: true });
    put(`G${t}`, f(hasV ? `SUM(G${first}:G${last})` : "0", monthly[m - 1].ventesHt), {
      fmt: EUR,
      bold: true,
    });
    put(`H${t}`, f(hasV ? `SUM(H${first}:H${last})` : "0", monthly[m - 1].hours), {
      fmt: "0.00",
      bold: true,
    });
    chargeTotalRef.push(`C${t}`);
    saleTotalRef.push(`G${t}`);
    row = t + 2;
  }

  // ---------- Synthèse ----------
  ws.mergeCells("A1:L1");
  put("A1", `CA ${year}`, { bold: true, color: WHITE, fill: BLUE, center: true });
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
    const col = String.fromCharCode(65 + i);
    if (col !== "A") ws.mergeCells(`${col}2:${col}3`);
    put(`${col}2`, h, { bold: true, color: WHITE, fill: BLUE, center: true });
  });
  put("A3", `Mois ${year}`, { bold: true, fill: GREEN });

  let cumC = 0;
  let cumH = 0;
  const evo: (number | null)[] = [];
  for (let m = 1; m <= 12; m++) {
    const r = m + 3;
    const mt = monthly[m - 1];
    const prev = prevMonthly[m - 1].ventesHt;
    cumC += mt.ventesHt;
    cumH += prev;
    const e = prev === 0 ? null : mt.ventesHt / prev - 1;
    evo.push(e);
    put(`A${r}`, MONTH_NAMES[m - 1], { bold: true });
    put(`B${r}`, f(chargeTotalRef[m - 1], mt.chargesHt), { fmt: EUR });
    put(`C${r}`, f(saleTotalRef[m - 1], mt.ventesHt), { fmt: EUR });
    put(`D${r}`, f(`C${r}*${1 + TVA_RATE}`, mt.ventesHt * (1 + TVA_RATE)), { fmt: EUR });
    put(`E${r}`, sapByMonth[m - 1], { fmt: EUR1 });
    put(`F${r}`, f(`C${r}-B${r}`, mt.ventesHt - mt.chargesHt), { fmt: EUR, bold: true });
    put(`G${r}`, f(`SUM($C$4:C${r})`, cumC), { fmt: EUR });
    put(`H${r}`, prev, { fmt: EUR1 });
    put(`I${r}`, f(`SUM($H$4:H${r})`, cumH), { fmt: EUR });
    put(`J${r}`, f(`IF(H${r}=0,"",C${r}/H${r}-1)`, e ?? ""), {
      fmt: "0.00%",
      fill: e != null && e >= 0 ? GREEN : undefined,
    });
  }
  // Remarques : trimestres (libellé puis moyenne des évolutions sur 3 mois)
  for (let q = 0; q < 4; q++) {
    const top = 4 + q * 3;
    const vals = evo.slice(q * 3, q * 3 + 3).filter((x): x is number => x != null);
    const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : "";
    put(`K${top}`, `Trimestre ${q + 1}`, { bold: true });
    ws.mergeCells(`K${top + 1}:K${top + 2}`);
    put(`K${top + 1}`, f(`IFERROR(AVERAGE(J${top}:J${top + 2}),"")`, avg), {
      fmt: "0.00%",
      bold: true,
      center: true,
    });
  }

  const lastM = 3 + n; // dernière ligne de mois écoulé
  const avgOver = (vals: Num[]) =>
    vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  const el = (fn: (i: number) => Num) => Array.from({ length: n }, (_, i) => fn(i));
  put("A16", "Moyennes", { bold: true });
  const avgCols: [string, Num][] = [
    ["B", avgOver(el((i) => monthly[i].chargesHt))],
    ["C", avgOver(el((i) => monthly[i].ventesHt))],
    ["D", avgOver(el((i) => monthly[i].ventesTtc))],
    ["E", avgOver(el((i) => sapByMonth[i]))],
    ["F", avgOver(el((i) => monthly[i].benefice))],
    ["H", avgOver(el((i) => prevMonthly[i].ventesHt))],
  ];
  for (const [col, v] of avgCols) {
    put(`${col}16`, f(`AVERAGE(${col}4:${col}${lastM})`, v), { fmt: col === "H" ? EUR1 : EUR });
  }
  put("G16", f(`G${lastM}`, cumC), { fmt: EUR });
  put("I16", f(`I${lastM}`, cumH), { fmt: EUR });
  const sumC = el((i) => monthly[i].ventesHt).reduce((s, x) => s + x, 0);
  const sumH = el((i) => prevMonthly[i].ventesHt).reduce((s, x) => s + x, 0);
  put(
    "J16",
    f(
      `IF(SUM(H4:H${lastM})=0,"",SUM(C4:C${lastM})/SUM(H4:H${lastM})-1)`,
      sumH ? sumC / sumH - 1 : "",
    ),
    {
      fmt: "0.00%",
    },
  );

  put("A17", "Moyenne mensuelle CA HT", { bold: true });
  put("B17", f(`AVERAGE(C4:C${lastM})`, avgOver(el((i) => monthly[i].ventesHt))), {
    fmt: EUR1,
    bold: true,
  });
  put("A18", "Bénéfice moyen mensuel", { bold: true });
  put("B18", f(`AVERAGE(F4:F${lastM})`, avgOver(el((i) => monthly[i].benefice))), {
    fmt: EUR,
    bold: true,
  });
  const yearNo = year - 2019; // 2020 = année 1
  put("A19", `CA HT Année ${yearNo} (${year})`, { bold: true });
  put("B19", f("SUM(C4:C15)", yt.ventesHt), { fmt: EUR1, bold: true });
  [...history].reverse().forEach((h, i) => {
    const r = 20 + i;
    put(`A${r}`, `CA HT Année ${h.year - 2019} (${h.year})`);
    put(`B${r}`, h.ventesHt, { fmt: EUR1 });
  });
  const rb = 20 + histRows;
  put(`A${rb}`, `Bénéfices nets Année ${yearNo}`, { bold: true });
  put(`B${rb}`, f("SUM(F4:F15)", yt.benefice), { fmt: EUR, bold: true });
  put(`A${rb + 1}`, `Investissements année ${yearNo}`);
  put(`B${rb + 1}`, invest, { fmt: EUR });
  put(`A${rb + 2}`, "Bénéfices après investissements", { bold: true });
  put(`B${rb + 2}`, f(`B${rb}-B${rb + 1}`, yt.benefice - invest), { fmt: EUR, bold: true });

  const sapTotal = sapByMonth.reduce((s, x) => s + x, 0);
  put("E17", `Total SAP ${year}`, { bold: true });
  put("E18", f("SUM(E4:E15)", sapTotal), { fmt: EUR1 });
  put("E23", `Total AP ${year}`, { bold: true });
  put("E24", f("B19-E18", yt.ventesHt - sapTotal), { fmt: EUR1 });

  // Contrôle : totaux calculés par PP (identiques à /pilot/ca)
  ws.getColumn(14).width = 34;
  ws.getColumn(15).width = 16;
  ws.getColumn(16).width = 12;
  put("N2", "Contrôle PP (valeurs de la page CA)", { bold: true, color: WHITE, fill: BLUE });
  put("O2", "Page CA", { bold: true, color: WHITE, fill: BLUE, center: true });
  put("P2", "Écart", { bold: true, color: WHITE, fill: BLUE, center: true });
  const ctl: [string, string, Num][] = [
    ["CA HT", "C16", yt.ventesHt],
    ["Charges HT", "B16", yt.chargesHt],
    ["Bénéfices nets", "F16", yt.benefice],
  ];
  // Totaux annuels = SUM des mois (les lignes 4-15)
  const ctlFormula = ["SUM(C4:C15)", "SUM(B4:B15)", "SUM(F4:F15)"];
  ctl.forEach(([label, , v], i) => {
    const r = 3 + i;
    put(`N${r}`, label);
    put(`O${r}`, v, { fmt: EUR });
    put(`P${r}`, f(`ROUND(${ctlFormula[i]}-O${r},2)`, 0), { fmt: EUR });
  });

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
