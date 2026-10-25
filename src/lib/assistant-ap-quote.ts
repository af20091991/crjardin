// Assistant AP — import de devis : normalisation des lignes extraites (logique pure).
import { normText, type QuoteLine, type SupplyCategory } from "@/lib/assistant-ap-catalogue";

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
