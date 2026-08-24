// ---------------------------------------------------------------------------
// RAPPROCHEMENT EXCEL → PILOT PRO : NATURE D'UNE LIGNE (Ventes / Charges)
//
// ORDRE DE RAPPROCHEMENT IMPOSÉ :
//   1. Excel  →  2. correspondance EXACTE de la désignation normalisée
//                →  3. classement Pilot Pro
//
// Le fichier Excel est la source de référence pour savoir si une désignation
// appartient au bloc Ventes ou au bloc Charges. Ce module :
//   • lit la structure du classeur et identifie explicitement les deux blocs ;
//   • construit une référence désignation → Ventes | Charges ;
//   • ne rapproche QUE sur égalité exacte de la désignation normalisée
//     (jamais de ressemblance approximative) ;
//   • n'écrit RIEN : aucune ligne n'est déplacée automatiquement ;
//   • signale tout désaccord Pilot Pro / Excel comme « Conflit à vérifier ».
// ---------------------------------------------------------------------------

import { normalizeLabel } from "@/lib/pilot-excel-time";

/** Nature structurelle d'une ligne, telle que lue dans le fichier Excel. */
export type ExcelNature = "vente" | "charge";

export const EXCEL_NATURE_LABEL: Record<ExcelNature, string> = {
  vente: "Ventes",
  charge: "Charges",
};

export interface ExcelNatureEntry {
  /** Désignation telle qu'écrite dans le fichier (première occurrence). */
  label: string;
  nature: ExcelNature;
  /** Nombre d'occurrences dans le bloc retenu. */
  occurrences: number;
  /** Bloc(s) où la désignation apparaît : > 1 = ambiguë, non exploitable. */
  blocks: ExcelNature[];
  /** Feuilles d'où provient la désignation. */
  sheets: string[];
}

export interface ExcelNatureIndex {
  /** Clé = désignation normalisée. */
  entries: Map<string, ExcelNatureEntry>;
  /** Nombre de lignes rattachées au bloc Ventes. */
  salesRows: number;
  /** Nombre de lignes rattachées au bloc Charges. */
  chargeRows: number;
  /** Blocs réellement identifiés dans le classeur. */
  blocksFound: ExcelNature[];
  sheets: string[];
}

// ── Détection des blocs ────────────────────────────────────────────────────

const SALES_WORDS = ["vente", "ventes", "ca", "chiffre d affaires", "recette", "recettes", "produit", "produits"];
const CHARGE_WORDS = ["charge", "charges", "depense", "depenses", "achat", "achats", "frais", "sortie", "sorties"];

/**
 * Bloc désigné par un titre de feuille ou une ligne d'en-tête de section.
 * `null` = aucun bloc reconnaissable (la lecture reste alors sans effet).
 */
export function blockFromTitle(raw: string | null | undefined): ExcelNature | null {
  const n = normalizeLabel(raw);
  if (!n) return null;
  const words = n.split(" ").filter(Boolean);
  const hasWord = (list: string[]) =>
    list.some((w) => (w.includes(" ") ? n.includes(w) : words.includes(w)));
  const sales = hasWord(SALES_WORDS);
  const charges = hasWord(CHARGE_WORDS);
  if (sales && charges) return null;
  if (sales) return "vente";
  if (charges) return "charge";
  return null;
}

/** Une cellule est-elle une simple étiquette de section (peu de contenu autour) ? */
function isSectionRow(cells: unknown[]): boolean {
  const filled = cells.filter((c) => c != null && String(c).trim() !== "");
  return filled.length > 0 && filled.length <= 2;
}

/**
 * Construit la référence désignation → bloc à partir des matrices de feuilles.
 * Un bloc courant est déterminé par le nom de la feuille puis, à l'intérieur de
 * la feuille, par les lignes de section « Ventes » / « Charges » rencontrées.
 */
export function buildExcelNatureIndex(
  sheets: readonly { name: string; matrix: readonly unknown[][] }[],
): ExcelNatureIndex {
  const entries = new Map<string, ExcelNatureEntry>();
  let salesRows = 0;
  let chargeRows = 0;
  const blocks = new Set<ExcelNature>();
  const sheetNames: string[] = [];

  for (const sheet of sheets) {
    sheetNames.push(sheet.name);
    const sheetBlock = blockFromTitle(sheet.name);
    let current: ExcelNature | null = sheetBlock;

    for (const row of sheet.matrix) {
      const cells = Array.isArray(row) ? row : [];
      if (cells.length === 0) continue;

      // Ligne de section : elle change le bloc courant et n'est pas une donnée.
      if (isSectionRow(cells)) {
        const found = cells
          .map((c) => blockFromTitle(c == null ? null : String(c)))
          .find((b): b is ExcelNature => b != null);
        if (found) {
          current = found;
          continue;
        }
      }

      if (!current) continue;

      // Désignation = première cellule texte non numérique de la ligne.
      const label = cells
        .map((c) => (c == null ? "" : String(c).trim()))
        .find((s) => s !== "" && !/^-?[\d\s.,€%]+$/.test(s));
      if (!label) continue;
      const key = normalizeLabel(label);
      if (!key) continue;
      if (blockFromTitle(label) != null) continue; // en-tête résiduel

      blocks.add(current);
      if (current === "vente") salesRows += 1;
      else chargeRows += 1;

      const existing = entries.get(key);
      if (!existing) {
        entries.set(key, {
          label,
          nature: current,
          occurrences: 1,
          blocks: [current],
          sheets: [sheet.name],
        });
      } else {
        existing.occurrences += 1;
        if (!existing.blocks.includes(current)) existing.blocks.push(current);
        if (!existing.sheets.includes(sheet.name)) existing.sheets.push(sheet.name);
      }
    }
  }

  return {
    entries,
    salesRows,
    chargeRows,
    blocksFound: [...blocks],
    sheets: sheetNames,
  };
}

/** Lecture d'un classeur .xlsx/.csv choisi par l'utilisateur (aucune écriture). */
export async function readExcelNatureFile(file: File): Promise<ExcelNatureIndex> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
    }) as unknown[][],
  }));
  return buildExcelNatureIndex(sheets);
}

// ── Consultation ────────────────────────────────────────────────────────────

export type ExcelLookup =
  /** Désignation trouvée dans un seul bloc : référence exploitable. */
  | { kind: "trouve"; nature: ExcelNature; entry: ExcelNatureEntry }
  /** Désignation présente dans les deux blocs : jamais exploitée seule. */
  | { kind: "ambigu"; entry: ExcelNatureEntry }
  /** Désignation absente du fichier. */
  | { kind: "absent" };

/** Correspondance EXACTE (après normalisation) — aucune ressemblance floue. */
export function lookupExcelNature(
  index: ExcelNatureIndex | null,
  designation: string | null | undefined,
): ExcelLookup {
  if (!index) return { kind: "absent" };
  const key = normalizeLabel(designation);
  if (!key) return { kind: "absent" };
  const entry = index.entries.get(key);
  if (!entry) return { kind: "absent" };
  if (entry.blocks.length > 1) return { kind: "ambigu", entry };
  return { kind: "trouve", nature: entry.nature, entry };
}

/** Nature structurelle actuelle d'une ligne Pilot Pro (vente ou charge). */
export function pilotNature(row: { kind?: string | null }): ExcelNature {
  return row.kind === "vente" ? "vente" : "charge";
}

export type NatureVerdict =
  /** Excel confirme le classement actuel de Pilot Pro. */
  | "accord"
  /** Excel indique un bloc différent : décision humaine obligatoire. */
  | "conflit"
  /** Désignation absente ou ambiguë dans Excel : classement Pilot Pro conservé. */
  | "hors_excel";

export const NATURE_VERDICT_LABEL: Record<NatureVerdict, string> = {
  accord: "Excel confirme l'emplacement",
  conflit: "Conflit à vérifier",
  hors_excel: "Non trouvée dans le fichier Excel",
};

export interface NatureComparison {
  verdict: NatureVerdict;
  pilot: ExcelNature;
  excel: ExcelNature | null;
  /** Explication lisible, affichée tel quel dans l'interface. */
  explanation: string;
}

/**
 * Compare le classement Pilot Pro à la référence Excel.
 * AUCUNE écriture, AUCUN déplacement automatique : un conflit reste visible et
 * la décision appartient à l'utilisateur.
 */
export function compareNatureWithExcel(
  row: { kind?: string | null; designation?: string | null },
  index: ExcelNatureIndex | null,
): NatureComparison {
  const pilot = pilotNature(row);
  const found = lookupExcelNature(index, row.designation);
  if (found.kind === "absent")
    return {
      verdict: "hors_excel",
      pilot,
      excel: null,
      explanation: "Désignation absente du fichier Excel : classement Pilot Pro conservé.",
    };
  if (found.kind === "ambigu")
    return {
      verdict: "hors_excel",
      pilot,
      excel: null,
      explanation: `Désignation présente dans les deux blocs du fichier (${found.entry.blocks
        .map((b) => EXCEL_NATURE_LABEL[b])
        .join(" et ")}) : correspondance non fiable, aucune conclusion.`,
    };
  if (found.nature === pilot)
    return {
      verdict: "accord",
      pilot,
      excel: found.nature,
      explanation: `Excel classe « ${found.entry.label} » dans ${EXCEL_NATURE_LABEL[found.nature]} : identique à Pilot Pro.`,
    };
  return {
    verdict: "conflit",
    pilot,
    excel: found.nature,
    explanation: `Pilot Pro : ${EXCEL_NATURE_LABEL[pilot]} — Excel : ${EXCEL_NATURE_LABEL[found.nature]}. Aucune modification automatique : votre décision est requise.`,
  };
}
