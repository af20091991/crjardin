// Assistant AP — import de devis : normalisation des lignes extraites (logique pure).
import {
  normText,
  type QuoteLine,
  type SupplierRef,
  type SupplyCategory,
} from "@/lib/assistant-ap-catalogue";

const CATEGORIES: SupplyCategory[] = [
  "vegetal",
  "terre",
  "amendement_paillage",
  "materiaux",
  "fixation",
  "irrigation",
  "autre",
];

/** Filet de sécurité : lignes de pur service / main-d'œuvre (l'IA fait le gros du tri). */
const SERVICE_RE =
  /main[- ]d ?oeuvre|\bm\.?o\.?\b|deplacement|frais (de|d )|heures?\b|temps de travail|forfait (main|deplacement|chantier|nettoyage)|terrassement|evacuation|nettoyage|etude|conception|remise en etat/;

/** Mots qui prouvent qu'une ligne décrit quand même une fourniture. */
const SUPPLY_HINT_RE =
  /fourniture|dallage|traverse|gravier|sable|canisse|terre|terreau|paillage|amendement|plant|arbuste|vegetal|bordure/;

export function isServiceLine(item: string): boolean {
  const t = normText(item);
  if (!SERVICE_RE.test(t)) return false;
  return !SUPPLY_HINT_RE.test(t);
}

interface RawLine {
  item?: unknown;
  quantity?: unknown;
  is_supply?: unknown;
  category?: unknown;
  plant_type?: unknown;
  plant_liters?: unknown;
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v || null;
}

/** Transforme la réponse brute de l'IA en lignes de fournitures propres et dédoublonnées. */
export function normalizeQuoteLines(raw: unknown): QuoteLine[] {
  const rows = Array.isArray((raw as { lines?: unknown })?.lines)
    ? ((raw as { lines: RawLine[] }).lines as RawLine[])
    : [];
  const seen = new Set<string>();
  const out: QuoteLine[] = [];
  for (const row of rows) {
    const item = text(row.item);
    if (!item) continue;
    if (row.is_supply === false || row.is_supply === "false") continue;
    if (isServiceLine(item)) continue;
    const category = CATEGORIES.includes(row.category as SupplyCategory)
      ? (row.category as SupplyCategory)
      : "autre";
    const liters =
      typeof row.plant_liters === "number" ? row.plant_liters : Number(row.plant_liters);
    const quantity = text(row.quantity);
    const key = `${normText(item)}|${quantity ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      item,
      quantity,
      category,
      plant_type: text(row.plant_type),
      plant_liters: Number.isFinite(liters) && liters > 0 ? liters : null,
    });
  }
  return out;
}

export const QUOTE_PROMPT = `Tu lis le texte d'un devis de paysagiste (aménagement de jardin). Extrais TOUTES les FOURNITURES à acheter chez un fournisseur : végétaux, terre, terreau, amendement, paillage, matériaux (dallage, gravier, sable, traverses, bordures…), fixations, canisses, irrigation, etc.
IMPORTANT : dans un devis de paysagiste, une même ligne mêle souvent fourniture et main-d'œuvre (« Fourniture et plantation de 12 lavandes », « Fourniture et pose de dallage », « Mise en place de terre végétale »). Ces lignes SONT des fournitures : extrais le produit (« Lavande », « Dallage », « Terre végétale ») avec sa quantité, sans le mot « plantation » ni « pose ».
EXCLUS seulement les lignes qui sont UNIQUEMENT du travail ou un service, sans produit : main-d'œuvre, heures, déplacement, terrassement, évacuation, nettoyage, forfait, étude, ainsi que totaux, remises, TVA, acomptes, conditions et coordonnées.
Réponds en JSON strict : {"lines":[{"item":"nom de la fourniture sans prix","quantity":"quantité telle qu'écrite (ex. 12, 3 sacs, 25 m²) ou null","is_supply":true,"category":"vegetal|terre|amendement_paillage|materiaux|fixation|irrigation|autre","plant_type":"arbuste|grimpante|arbre|vivace|haie|autre ou null","plant_liters":volume du pot en litres (nombre) ou null}]}.
Ne mets jamais de prix. N'invente aucune ligne. Garde les précisions utiles dans item (ex. « H2 », « 35L », « biologique », « professionnel », « composé »).`;

// ───────────── Lecture directe des devis « tableau » (Référence · Désignation · Qté · PU · TVA · Montant) ─────────────

const NUM = "\\d+(?:[.,]\\d+)?";
const ROW_RE = new RegExp(
  `^(.+?)\\s+(${NUM})\\s+(${NUM})\\s*€\\s+(${NUM})\\s+(-?\\d[\\d\\s]*[.,]\\d+)\\s*€$`,
);

function toNumber(value: string): number {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

/** Retire la référence (1er mot) et un éventuel complément « (copie) » / « (c… ». */
function stripReference(left: string): string {
  const words = left.trim().split(/\s+/);
  if (words.length < 2) return left.trim();
  words.shift();
  if (/^\(.*(\)|…)$/.test(words[0]) && words.length > 1) words.shift();
  return words.join(" ");
}

/** Cherche un nom de fournisseur du catalogue écrit comme mot entier dans la désignation. */
function findSupplierTag(designation: string, suppliers: SupplierRef[]): string | null {
  for (const supplier of suppliers) {
    for (const name of [supplier.name, ...(supplier.aliases ?? [])]) {
      const n = name.trim();
      if (n.length < 2 || /\s/.test(n)) continue;
      const escaped = n.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
      if (new RegExp(`(^|[\\s(/-])${escaped}($|[\\s)/,.-])`, "i").test(designation)) return n;
    }
  }
  return null;
}

function removeTag(designation: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
  return designation
    .replace(new RegExp(`(^|[\\s(/-])${escaped}(?=$|[\\s)/,.-])`, "i"), "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s-]+$/, "")
    .trim();
}

export interface QuoteBlockRow {
  /** group_key de la ligne regroupée correspondante. */
  key: string;
  item: string;
  quantity: number;
}

/** Bloc du devis : lignes de description (zone, végétaux cités…) suivies de ses rangées végétales. */
export interface QuoteBlock {
  lines: string[];
  rows: QuoteBlockRow[];
}

const BOILERPLATE_RE =
  /^(DEVIS N°|Référence\b|Bon pour Accord|Conditions de paiement|Sous Total|Total HT|Total TTC|Net à payer|TVA\b|Page \d+)/i;

function isVegetalDesignation(designation: string): boolean {
  return /vivace|arbuste|arbre|grimpante|haie|godet|gazon/i.test(designation);
}

/**
 * Lit directement les lignes d'un devis tabulaire (texte du PDF, une ligne par rangée).
 * Les lignes de main-d'œuvre/services sont écartées ; les doublons sont cumulés.
 * Renvoie aussi les blocs de description rattachés aux rangées végétales (liste des plantes).
 * Renvoie lines = [] si le texte ne ressemble pas à ce format (→ repli sur l'IA).
 */
export function parseTabularQuoteDetailed(
  text: string,
  suppliers: SupplierRef[] = [],
): { lines: QuoteLine[]; blocks: QuoteBlock[] } {
  const rawLines = text.split("\n").map((l) => l.trim());
  const merged = new Map<string, QuoteLine & { total: number }>();
  const blocks: QuoteBlock[] = [];
  let current: QuoteBlock = { lines: [], rows: [] };
  let lastRef = "";
  let lastKey: string | null = null;
  let inFooter = false;
  let stopped = false;
  // Avant l'en-tête du tableau : coordonnées, titre… (ignorés s'il existe un en-tête).
  const hasHeader = rawLines.some((l) => /^Référence\b.*Désignation/i.test(l));
  let started = !hasHeader;

  const flush = () => {
    if (current.rows.length > 0) blocks.push(current);
    current = { lines: [], rows: [] };
  };

  for (const line of rawLines) {
    if (stopped || !line) continue;
    if (!started) {
      if (/^Référence\b.*Désignation/i.test(line)) started = true;
      continue;
    }
    if (/^Bon pour Accord/i.test(line)) {
      stopped = true;
      continue;
    }
    // Pied de page (clauses légales) : ignoré jusqu'à « Page n / m ».
    if (/^CLAUSE DE R/i.test(line)) inFooter = true;
    if (inFooter) {
      if (/Page \d+\s*\/\s*\d+/i.test(line)) inFooter = false;
      continue;
    }
    if (/^Sous Total/i.test(line)) {
      flush();
      lastKey = null;
      continue;
    }

    const m = line.match(ROW_RE);
    if (!m) {
      // Suite de désignation sur la ligne suivante : elle reprend la référence de la rangée.
      if (lastKey && lastRef && line.toLowerCase().startsWith(lastRef.toLowerCase() + " ")) {
        const entry = merged.get(lastKey);
        if (entry && !/\d+[.,]\d+\s*€/.test(line)) {
          entry.item = `${entry.item} ${line.slice(lastRef.length).trim()}`.trim();
        }
        lastKey = null;
        continue;
      }
      lastKey = null;
      if (BOILERPLATE_RE.test(line) || /\d+[.,]\d+\s*€/.test(line)) continue;
      if (current.rows.length > 0) flush();
      current.lines.push(line);
      continue;
    }
    const [, left, qty] = m;
    lastRef = left.trim().split(/\s+/)[0] ?? "";
    let designation = stripReference(left);
    if (!designation || isServiceLine(designation) || /^main[- ]d/i.test(designation)) {
      lastKey = null;
      continue;
    }
    const tag = findSupplierTag(designation, suppliers);
    if (tag) designation = removeTag(designation, tag) || designation;
    const quantity = toNumber(qty);
    const key = `${normText(designation)}|${tag ? normText(tag) : ""}`;
    const existing = merged.get(key);
    if (existing) {
      existing.total += quantity;
      existing.quantity = formatQuantity(existing.total);
    } else {
      const liters = normText(designation).match(/(\d+(?:[.,]\d+)?)\s*l\b/);
      merged.set(key, {
        item: designation,
        quantity: formatQuantity(quantity),
        total: quantity,
        category: isVegetalDesignation(designation) ? "vegetal" : "autre",
        plant_type: /vivace/i.test(designation)
          ? "vivace"
          : /arbuste/i.test(designation)
            ? "arbuste"
            : /arbre/i.test(designation)
              ? "arbre"
              : null,
        plant_liters: liters ? toNumber(liters[1]) : null,
        supplier_tag: tag,
        group_key: key,
      });
    }
    if (isVegetalDesignation(designation)) {
      current.rows.push({ key, item: designation, quantity });
    }
    lastKey = key;
  }
  flush();
  return {
    lines: [...merged.values()].map(({ total: _total, ...line }) => line),
    blocks,
  };
}

export function parseTabularQuote(text: string, suppliers: SupplierRef[] = []): QuoteLine[] {
  return parseTabularQuoteDetailed(text, suppliers).lines;
}
