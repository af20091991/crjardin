// Lecture d'un planning d'entretien (PDF ou Word .docx) — côté navigateur.
// On extrait un tableau et on en déduit, par mois, la liste des
// « Travaux à effectuer ».

export interface PlanningRow {
  index: number; // ordre dans le document
  month: number; // 1-12
  monthLabel: string; // "Juin"
  label: string; // libellé de l'intervention, ex "Juin 2"
  type: string; // type d'intervention, ex "Rotofil · Taille"
  tasks: string[];
}

const MONTHS: { name: string; num: number }[] = [
  { name: "janvier", num: 1 },
  { name: "fevrier", num: 2 },
  { name: "mars", num: 3 },
  { name: "avril", num: 4 },
  { name: "mai", num: 5 },
  { name: "juin", num: 6 },
  { name: "juillet", num: 7 },
  { name: "aout", num: 8 },
  { name: "septembre", num: 9 },
  { name: "octobre", num: 10 },
  { name: "novembre", num: 11 },
  { name: "decembre", num: 12 },
];

function deburr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function monthFromString(s: string): { num: number; label: string } | null {
  const d = deburr(s);
  for (const m of MONTHS) {
    if (d.includes(m.name)) {
      return { num: m.num, label: m.name.charAt(0).toUpperCase() + m.name.slice(1) };
    }
  }
  return null;
}

// Découpe le contenu d'une cellule « Travaux à effectuer » en tâches.
function splitCellTasks(cell: string): string[] {
  const out: string[] = [];
  const lines = cell
    .split(/\r?\n|<br\s*\/?>(?![^<]*>)/i)
    .flatMap((l) => l.split(/[;•·▪‣◦]/))
    .map((l) => l.trim())
    .filter(Boolean);
  for (const raw of lines) {
    const cleaned = raw
      .replace(/^[\s•·▪‣◦*\-–—]+/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (cleaned.length < 2) continue;
    if (cleaned.length > 200) continue;
    const d = deburr(cleaned);
    if (d.includes("pas d'intervention") || d.includes("pas d intervention")) continue;
    out.push(cleaned);
  }
  return Array.from(new Set(out));
}

// Lignes parasites (en-têtes de page, notes, totaux, signature…)
function isNoiseRow(joined: string): boolean {
  const d = deburr(joined);
  if (/^\d{1,3}$/.test(d.trim())) return true; // numéro de page
  return [
    "planning d'entretien",
    "planning d",
    "jardin de mme",
    "travaux a effectuer",
    "type d'intervention",
    "type d intervention",
    "mois d'intervention",
    "mois d intervention",
    "lie aux devis",
    "devis sap",
    "total entretien",
    "respect de la saisonnalite",
    "signature",
    "ce planning",
    "prix ttc",
    "facturation",
    "remise fidelite",
    "sous-total",
    "ajouts de travaux",
    "interventions :",
  ].some((p) => d.includes(p));
}

// Sections après lesquelles il n'y a plus d'interventions (on arrête le parsing)
function isStopRow(joined: string): boolean {
  const d = deburr(joined);
  return ["total entretien", "ce planning", "respect de la saisonnalite", "note :"].some(
    (p) => d.includes(p),
  );
}

// ───────────────────────── Extraction du tableau ─────────────────────────

async function tableFromDocx(file: File): Promise<string[][]> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = doc.querySelectorAll("table");
  if (!tables.length) return [];
  const rows: string[][] = [];
  tables.forEach((table) => {
    table.querySelectorAll("tr").forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("th,td").forEach((td) => {
      // remplace les blocs par des sauts de ligne pour conserver les tâches
      const blocks = td.querySelectorAll("p,li,br");
      let text: string;
      if (blocks.length) {
        text = Array.from(td.querySelectorAll("p,li"))
          .map((b) => (b.textContent || "").trim())
          .filter(Boolean)
          .join("\n");
        if (!text) text = (td.textContent || "").trim();
      } else {
        text = (td.textContent || "").trim();
      }
      cells.push(text);
    });
    if (cells.length) rows.push(cells);
    });
  });
  return rows;
}

async function planningFromPdf(file: File): Promise<PlanningRow[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;

  type Item = { str: string; x: number; y: number };
  const all: Item[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageOffset = (i - 1) * 100000;
    for (const it of content.items as any[]) {
      if (!("str" in it) || !it.str.trim()) continue;
      const tr = it.transform as number[];
      all.push({ str: it.str, x: tr[4], y: pageOffset - tr[5] });
    }
  }

  // Détection des 3 colonnes (Mois | Type | Travaux) par pics de densité des
  // positions horizontales : l'en-tête est centré, mais le contenu est calé à
  // gauche de chaque colonne, formant 3 pics nets.
  const BIN = 10;
  const hist = new Map<number, number>();
  for (const it of all) {
    const b = Math.round(it.x / BIN) * BIN;
    hist.set(b, (hist.get(b) ?? 0) + 1);
  }
  const bins = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  const peaks = bins
    .filter(([, n]) => n >= 5)
    .filter(([x, n]) => !bins.some(([x2, n2]) => Math.abs(x2 - x) <= 20 && n2 > n))
    .sort((a, b) => b[1] - a[1]);
  const chosen: number[] = [];
  for (const [x] of peaks) {
    if (chosen.every((c) => Math.abs(c - x) >= 80)) chosen.push(x);
    if (chosen.length === 3) break;
  }
  chosen.sort((a, b) => a - b);

  // Regroupement en lignes par coordonnée Y
  all.sort((a, b) => a.y - b.y || a.x - b.x);
  type Line = { y: number; month: string; type: string; travaux: string };
  const rawLines: Item[][] = [];
  let current: Item[] = [];
  let lastY = Number.NEGATIVE_INFINITY;
  for (const it of all) {
    if (current.length && Math.abs(it.y - lastY) > 4) {
      rawLines.push(current);
      current = [];
    }
    current.push(it);
    lastY = it.y;
  }
  if (current.length) rawLines.push(current);

  // Sans 3 colonnes fiables : repli sur une seule colonne « travaux »
  const typeStart = chosen.length === 3 ? (chosen[0] + chosen[1]) / 2 : -1;
  const travauxStart = chosen.length === 3 ? (chosen[1] + chosen[2]) / 2 : -1;

  const lines: Line[] = rawLines.map((line) => {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    const join = (pred: (x: number) => boolean) =>
      sorted.filter((i) => pred(i.x)).map((i) => i.str).join(" ").trim();
    if (travauxStart < 0) {
      return { y: sorted[0].y, month: "", type: "", travaux: join(() => true) };
    }
    return {
      y: sorted[0].y,
      month: join((x) => x < typeStart),
      type: join((x) => x >= typeStart && x < travauxStart),
      travaux: join((x) => x >= travauxStart),
    };
  });

  // Coupe au début des sections « totaux / conditions »
  let cutoff = Number.POSITIVE_INFINITY;
  for (const l of lines) {
    if (isStopRow([l.month, l.type, l.travaux].join(" "))) {
      cutoff = l.y;
      break;
    }
  }

  // Repérage des « ancres » : lignes contenant un mois (= début d'intervention)
  type Anchor = {
    y: number;
    month: number;
    monthLabel: string;
    label: string;
    typeTokens: Set<string>;
    tasks: string[];
  };
  const anchors: Anchor[] = [];
  for (const l of lines) {
    if (l.y >= cutoff) continue;
    const joined = [l.month, l.type, l.travaux].join(" ");
    if (isNoiseRow(joined)) continue;
    const mInMonth = monthFromString(l.month);
    const mInType = l.month.trim() === "" ? monthFromString(l.type) : null;
    const m = mInMonth || mInType;
    if (m) {
      anchors.push({
        y: l.y,
        month: m.num,
        monthLabel: m.label,
        label: (mInMonth ? l.month : l.type).replace(/\s+/g, " ").trim() || m.label,
        typeTokens: new Set(),
        tasks: [],
      });
    }
  }
  if (anchors.length === 0) return [];

  // Frontières entre interventions = milieu entre deux ancres consécutives
  const lowB: number[] = [];
  const highB: number[] = [];
  for (let i = 0; i < anchors.length; i++) {
    lowB[i] = i === 0 ? Number.NEGATIVE_INFINITY : (anchors[i - 1].y + anchors[i].y) / 2;
    highB[i] =
      i === anchors.length - 1
        ? Number.POSITIVE_INFINITY
        : (anchors[i].y + anchors[i + 1].y) / 2;
  }

  for (const l of lines) {
    if (l.y >= cutoff) continue;
    const joined = [l.month, l.type, l.travaux].join(" ");
    if (isNoiseRow(joined)) continue;
    const idx = anchors.findIndex((_, i) => l.y >= lowB[i] && l.y < highB[i]);
    if (idx < 0) continue;
    if (l.travaux.trim()) anchors[idx].tasks.push(...splitCellTasks(l.travaux));
    if (l.type.trim()) {
      l.type
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2)
        .forEach((t) => anchors[idx].typeTokens.add(t));
    }
  }

  return anchors.map<PlanningRow>((a, i) => ({
    index: i,
    month: a.month,
    monthLabel: a.monthLabel,
    label: a.label,
    type: [...a.typeTokens].slice(0, 6).join(" · "),
    tasks: Array.from(new Set(a.tasks)),
  }));
}

// ───────────────────────── Construction du planning ─────────────────────────

function planningFromTable(rows: string[][]): PlanningRow[] {
  if (rows.length === 0) return [];

  // Cherche l'en-tête et l'indice de la colonne « Travaux à effectuer »
  let headerIdx = -1;
  let travauxCol = -1;
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map(deburr);
    const c = cells.findIndex((x) => x.includes("travaux") && x.includes("effectuer"));
    if (c >= 0) {
      headerIdx = r;
      travauxCol = c;
      break;
    }
  }

  // Colonne du mois : celle où on trouve le plus de noms de mois
  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  const colCount = Math.max(...rows.map((r) => r.length));
  let monthCol = 0;
  if (headerIdx >= 0) {
    let best = -1;
    for (let c = 0; c < colCount; c++) {
      if (c === travauxCol) continue;
      let count = 0;
      for (let r = startRow; r < rows.length; r++) {
        if (rows[r][c] && monthFromString(rows[r][c])) count++;
      }
      if (count > best) {
        best = count;
        monthCol = c;
      }
    }
  }
  // Colonne « Type d'intervention » : la colonne restante
  let typeCol = -1;
  for (let c = 0; c < colCount; c++) {
    if (c !== monthCol && c !== travauxCol) {
      typeCol = c;
      break;
    }
  }

  const cleanLabel = (s: string) => s.replace(/\s+/g, " ").trim();
  const mergeType = (existing: string, add: string) => {
    const tokens = new Set(
      [...existing.split("·"), ...add.split(/\r?\n|·/)]
        .map((t) => t.trim())
        .filter(Boolean),
    );
    return Array.from(tokens).join(" · ");
  };

  const result: PlanningRow[] = [];
  let lastRow: PlanningRow | null = null;
  let order = 0;
  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const get = (c: number) => (c >= 0 && c < row.length ? row[c] || "" : "");
    const monthText = travauxCol >= 0 ? get(monthCol) : row.join(" ");
    const typeText = get(typeCol);
    const travauxText = travauxCol >= 0 ? get(travauxCol) : row.join(" ");
    if (isNoiseRow([monthText, typeText, travauxText].join(" "))) continue;

    const tasks = splitCellTasks(travauxText);
    // Nouvelle intervention : un mois dans la colonne mois (ou, à défaut,
    // dans la colonne type — cas des cellules fusionnées).
    const monthInMonth = monthFromString(monthText);
    const monthInType = monthText.trim() === "" ? monthFromString(typeText) : null;
    const m = monthInMonth || monthInType;
    if (m && (monthText.trim() !== "" || typeText.trim() !== "")) {
      lastRow = {
        index: order++,
        month: m.num,
        monthLabel: m.label,
        label: cleanLabel(monthInMonth ? monthText : typeText) || m.label,
        type: cleanLabel(monthInMonth ? typeText.replace(/\r?\n/g, " · ") : ""),
        tasks: [...tasks],
      };
      result.push(lastRow);
    } else if (lastRow && monthText.trim() === "" && tasks.length) {
      // ligne de continuation (cellule fusionnée sur plusieurs lignes PDF)
      lastRow.tasks.push(...tasks.filter((t) => !lastRow!.tasks.includes(t)));
      if (typeText.trim()) lastRow.type = mergeType(lastRow.type, typeText);
    }
  }

  // On conserve l'ordre du document (séquence des interventions).
  return result;
}

export async function parsePlanning(file: File): Promise<PlanningRow[]> {
  const name = file.name.toLowerCase();
  let rows: string[][];
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    rows = await tableFromPdf(file);
  } else if (
    name.endsWith(".docx") ||
    file.type.includes("word") ||
    file.type.includes("officedocument")
  ) {
    rows = await tableFromDocx(file);
  } else {
    rows = (await file.text()).split(/\r?\n/).map((l) => [l]);
  }
  return planningFromTable(rows);
}