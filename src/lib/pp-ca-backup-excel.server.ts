// Génération du classeur « Backup PP CA » (fidèle au modèle Suivi_mensuel_CA).
// Aucune règle métier réimplémentée : les montants proviennent des mêmes
// fonctions que la page /pilot/ca (monthTotals, categoryTotals,
// investmentsTotal, revenueCounted, hoursCounted, keepRealizedYearMonth).
import ExcelJS from "exceljs";
import { MONTH_NAMES, categoryTotals, monthTotals, yearTotals, type CaEntry } from "@/lib/pilot-ca";
import { investmentsTotal } from "@/lib/pilot-ca-investments";
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import { hoursCounted, revenueCounted } from "@/lib/pilot-sale-accounting";

const BLUE = "FF0F9DE8";
const GREEN = "FF92D050";
const ORANGE = "FFFFC000";
const EUR = '#,##0.00 "€"';
const thin = { style: "thin" as const };
const border = { top: thin, left: thin, bottom: thin, right: thin };

export interface BackupInput {
  year: number;
  entries: CaEntry[];
  previousEntries: CaEntry[];
  /** Bénéfice net annuel des exercices précédents (du plus ancien au plus récent). */
  history: { year: number; benefice: number }[];
  options: AsOfOptions;
}

function fill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export async function buildCaBackupWorkbook(input: BackupInput): Promise<ArrayBuffer> {
  const { year, entries, previousEntries, history, options } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CR Pro — De la graine au jardin";
  const ws = wb.addWorksheet(`CA ${year}`);
  ws.properties.defaultRowHeight = 15;
  [22, 16, 16, 16, 16, 16, 18, 18, 18, 18, 24, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const style = (c: ExcelJS.Cell, numFmt?: string) => {
    c.font = { name: "Calibri", size: 11, ...(c.font ?? {}) };
    c.border = border;
    if (numFmt) c.numFmt = numFmt;
  };

  ws.mergeCells("A1:L1");
  const title = ws.getCell("A1");
  title.value = `CA ${year}`;
  title.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  title.alignment = { horizontal: "center" };
  fill(title, BLUE);

  const headers = [
    `CA ${year}`,
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
    "Moyenne trimestrielle CA HT",
  ];
  headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    ws.mergeCells(`${col}2:${col}3`);
    const c = ws.getCell(`${col}2`);
    c.value = h;
    c.font = { name: "Calibri", size: 11, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    fill(c, ORANGE);
    style(c);
  });

  // ---------- Détails (à partir de la ligne 30) ----------
  const keep = (e: CaEntry) =>
    keepRealizedYearMonth({ year: Number(e.year), month: Number(e.month), entry_date: e.entry_date }, options);
  const DETAIL_START = 30;
  ws.mergeCells(`A${DETAIL_START}:B${DETAIL_START}`);
  ws.mergeCells(`D${DETAIL_START}:F${DETAIL_START}`);
  for (const [addr, label] of [
    [`A${DETAIL_START}`, "Détails des charges"],
    [`D${DETAIL_START}`, "Détails des ventes"],
  ] as const) {
    const c = ws.getCell(addr);
    c.value = label;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    fill(c, BLUE);
    style(c);
  }
  const sub = DETAIL_START + 1;
  [
    ["A", "Désignation"],
    ["B", "Montant HT"],
    ["D", "Désignation"],
    ["E", "Montant HT"],
    ["F", "Temps (heures)"],
  ].forEach(([col, label]) => {
    const c = ws.getCell(`${col}${sub}`);
    c.value = label;
    c.font = { name: "Calibri", size: 11, bold: true };
    fill(c, ORANGE);
    style(c);
  });

  const chargeTotals: string[] = [];
  const saleTotals: string[] = [];
  let rc = sub + 1;
  let rv = sub + 1;
  for (let m = 1; m <= 12; m++) {
    const monthRows = entries.filter((e) => Number(e.month) === m && keep(e));
    const charges = monthRows.filter((e) => e.kind === "charge" && !e.is_investment);
    const ventes = monthRows.filter(
      (e) => e.kind === "vente" && (revenueCounted(e.sale_status, options) || hoursCounted(e.sale_status)),
    );

    // Charges
    ws.mergeCells(`A${rc}:B${rc}`);
    const hc = ws.getCell(`A${rc}`);
    hc.value = MONTH_NAMES[m - 1];
    hc.font = { name: "Calibri", size: 11, bold: true };
    fill(hc, GREEN);
    style(hc);
    const firstC = rc + 1;
    rc++;
    for (const e of charges) {
      const a = ws.getCell(`A${rc}`);
      a.value = e.designation ?? "";
      fill(a, GREEN);
      style(a);
      const b = ws.getCell(`B${rc}`);
      b.value = Number(e.amount_ht) || 0;
      fill(b, GREEN);
      style(b, EUR);
      rc++;
    }
    const tc = ws.getCell(`A${rc}`);
    tc.value = `Total ${MONTH_NAMES[m - 1]}`;
    tc.font = { name: "Calibri", size: 11, bold: true };
    style(tc);
    const tcv = ws.getCell(`B${rc}`);
    tcv.value = { formula: rc > firstC ? `SUM(B${firstC}:B${rc - 1})` : "0", result: 0 };
    tcv.font = { name: "Calibri", size: 11, bold: true };
    style(tcv, EUR);
    chargeTotals.push(`B${rc}`);
    rc += 2;

    // Ventes
    ws.mergeCells(`D${rv}:F${rv}`);
    const hv = ws.getCell(`D${rv}`);
    hv.value = MONTH_NAMES[m - 1];
    hv.font = { name: "Calibri", size: 11, bold: true };
    fill(hv, GREEN);
    style(hv);
    const firstV = rv + 1;
    rv++;
    for (const e of ventes) {
      const counted = revenueCounted(e.sale_status, options);
      const d = ws.getCell(`D${rv}`);
      d.value = (e.designation ?? "") + (counted ? "" : " (facturé, non réglé)");
      fill(d, GREEN);
      style(d);
      const ev = ws.getCell(`E${rv}`);
      ev.value = counted ? Number(e.amount_ht) || 0 : 0;
      fill(ev, GREEN);
      style(ev, EUR);
      const f = ws.getCell(`F${rv}`);
      f.value = hoursCounted(e.sale_status) && e.hours != null ? Number(e.hours) : null;
      style(f, "0.00");
      rv++;
    }
    const tv = ws.getCell(`D${rv}`);
    tv.value = `Total ${MONTH_NAMES[m - 1]}`;
    tv.font = { name: "Calibri", size: 11, bold: true };
    style(tv);
    const has = rv > firstV;
    const tvv = ws.getCell(`E${rv}`);
    tvv.value = { formula: has ? `SUM(E${firstV}:E${rv - 1})` : "0", result: 0 };
    tvv.font = { name: "Calibri", size: 11, bold: true };
    style(tvv, EUR);
    const tvh = ws.getCell(`F${rv}`);
    tvh.value = { formula: has ? `SUM(F${firstV}:F${rv - 1})` : "0", result: 0 };
    tvh.font = { name: "Calibri", size: 11, bold: true };
    style(tvh, "0.00");
    saleTotals.push(`E${rv}`);
    rv += 2;
  }

  // ---------- Synthèse lignes 4-15 ----------
  for (let m = 1; m <= 12; m++) {
    const r = m + 3;
    const sap = categoryTotals(entries, m, options).find((c) => c.category === "SAP")?.ht ?? 0;
    const prev = monthTotals(previousEntries, m, options).ventesHt;
    const a = ws.getCell(`A${r}`);
    a.value = MONTH_NAMES[m - 1];
    a.font = { name: "Calibri", size: 11, bold: true };
    fill(a, GREEN);
    style(a);
    const set = (col: string, value: ExcelJS.CellValue, fmt?: string) => {
      const c = ws.getCell(`${col}${r}`);
      c.value = value;
      style(c, fmt);
    };
    set("B", { formula: chargeTotals[m - 1], result: 0 }, EUR);
    set("C", { formula: saleTotals[m - 1], result: 0 }, EUR);
    set("D", { formula: `C${r}*1.2`, result: 0 }, EUR);
    set("E", sap, EUR);
    set("F", { formula: `C${r}-B${r}`, result: 0 }, EUR);
    set("G", { formula: `SUM($C$4:C${r})`, result: 0 }, EUR);
    set("H", prev, EUR);
    set("I", { formula: `SUM($H$4:H${r})`, result: 0 }, EUR);
    set("J", { formula: `IF(H${r}=0,"",C${r}/H${r}-1)`, result: 0 }, "0.00%");
    set("K", null);
  }
  for (let q = 0; q < 4; q++) {
    const top = 4 + q * 3;
    ws.mergeCells(`L${top}:L${top + 2}`);
    const c = ws.getCell(`L${top}`);
    c.value = { formula: `AVERAGE(C${top}:C${top + 2})`, result: 0 };
    c.alignment = { vertical: "middle" };
    style(c, EUR);
  }

  // ---------- Totaux & moyennes ----------
  const label = (addr: string, text: string, color?: string) => {
    const c = ws.getCell(addr);
    c.value = text;
    c.font = { name: "Calibri", size: 11, bold: true };
    if (color) fill(c, color);
    style(c);
  };
  const formula = (addr: string, f: string, fmt = EUR) => {
    const c = ws.getCell(addr);
    c.value = { formula: f, result: 0 };
    style(c, fmt);
  };
  label("A16", "Total", ORANGE);
  for (const col of ["B", "C", "D", "E", "F", "H"]) formula(`${col}16`, `SUM(${col}4:${col}15)`);
  formula("J16", `IF(H16=0,"",C16/H16-1)`, "0%");
  label("A17", "Moyennes");
  for (const col of ["B", "C", "D", "F"]) formula(`${col}17`, `AVERAGE(${col}4:${col}15)`);
  label("A18", "Bénéfice moyen mensuel");
  formula("B18", "AVERAGE(F4:F15)");
  for (let q = 1; q <= 4; q++) {
    const top = 4 + (q - 1) * 3;
    label(`A${18 + q}`, `Trimestre ${q}`);
    formula(`B${18 + q}`, `SUM(C${top}:C${top + 2})`);
    formula(`C${18 + q}`, `AVERAGE(C${top}:C${top + 2})`);
  }

  const ap = categoryTotals(entries, undefined, options).find((c) => c.category === "AP")?.ht ?? 0;
  label("E19", "Total SAP", GREEN);
  formula("E20", "SUM(E4:E15)");
  label("E22", "Total AP", GREEN);
  const apCell = ws.getCell("E23");
  apCell.value = ap;
  style(apCell, EUR);
  formula("E24", `IF(C16=0,"",E20/C16)`, "0%");

  label("H17", "Bénéfices nets", ORANGE);
  const years = [...history.slice(-6)];
  let r = 18;
  years.forEach((h, i) => {
    label(`H${r}`, `Bénéfices nets Année ${years.length + 1 - i} (${h.year})`);
    const c = ws.getCell(`I${r}`);
    c.value = h.benefice;
    style(c, EUR);
    r++;
  });
  label(`H${r}`, `Bénéfices nets Année 1 (${year})`);
  formula(`I${r}`, "F16");
  const benefitRow = r;
  r++;
  label(`H${r}`, `Investissements année ${year}`);
  const inv = ws.getCell(`I${r}`);
  inv.value = investmentsTotal(entries, undefined, options);
  style(inv, EUR);
  r++;
  label(`H${r}`, "Bénéfices après investissements");
  formula(`I${r}`, `I${benefitRow}-I${r - 1}`);

  // Contrôle : totaux calculés par PP (identiques à /pilot/ca)
  const yt = yearTotals(entries, options);
  label("K17", "Contrôle PP (CA HT)");
  const k = ws.getCell("K18");
  k.value = yt.ventesHt;
  style(k, EUR);
  label("K19", "Contrôle PP (Charges HT)");
  const k2 = ws.getCell("K20");
  k2.value = yt.chargesHt;
  style(k2, EUR);

  ws.views = [{ state: "frozen", ySplit: 3 }];
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
