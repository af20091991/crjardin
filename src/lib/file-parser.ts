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

async function tableFromPdf(file: File): Promise<string[][]> {
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

  // Regroupement en lignes par coordonnée Y (tolérance)
  all.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Item[][] = [];
  let current: Item[] = [];
  let lastY = Number.NEGATIVE_INFINITY;
  for (const it of all) {
    if (current.length && Math.abs(it.y - lastY) > 4) {
      lines.push(current);
      current = [];
    }
    current.push(it);
    lastY = it.y;
  }
  if (current.length) lines.push(current);

  // Frontières des colonnes (Mois | Type | Travaux à effectuer) depuis l'en-tête
  let typeStart = -1;
  let travauxStart = -1;
  for (const line of lines) {
    const joined = deburr(line.map((i) => i.str).join(" "));
    if (joined.includes("travaux") && joined.includes("effectuer")) {
      const sorted = [...line].sort((a, b) => a.x - b.x);
      const tIdx = sorted.findIndex((i) => deburr(i.str).includes("travaux"));
      if (tIdx >= 0) travauxStart = sorted[tIdx].x - 2;
      const typeIdx = sorted.findIndex((i) => deburr(i.str).includes("type"));
      if (typeIdx >= 0) typeStart = sorted[typeIdx].x - 2;
      break;
    }
  }
  if (typeStart < 0) typeStart = travauxStart;

  const rows: string[][] = [];
  for (const line of lines) {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    if (travauxStart >= 0) {
      const join = (pred: (x: number) => boolean) =>
        sorted.filter((i) => pred(i.x)).map((i) => i.str).join(" ").trim();
      const monthCell = join((x) => x < typeStart);
      const typeCell = join((x) => x >= typeStart && x < travauxStart);
      const travauxCell = join((x) => x >= travauxStart);
      rows.push([monthCell, typeCell, travauxCell]);
    } else {
      rows.push([sorted.map((i) => i.str).join(" ").trim()]);
    }
  }
  return rows;
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