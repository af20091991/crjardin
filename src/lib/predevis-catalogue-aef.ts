// Pré-devis — catalogue AEF (L'Arc en Fleurs, « Disponible Pro ») : lecture pure.
// Le prix pro HT est déjà calculé par le fournisseur (TVA et remise appliquées) : on le reprend tel quel.
// Une ligne sans prix ou sans espèce est écartée et comptée, jamais estimée.
import { normText, parsePrice } from "./predevis-catalogue-normalize";

export type AefSpecies = {
  species: string;
  /** Taille telle qu'écrite dans le fichier AEF. */
  size: string;
  /** Clé de taille comparable avec nos produits (ex. « 1.4LAC », « 3L »). null = non reconnue. */
  sizeKey: string | null;
  proPriceHt: number;
  wooId: string | null;
};

export const AEF_SHEET = "Disponible alphabétique";

/**
 * Clé de taille : litres + « AC » pour les pots anti-chignon.
 * Même clé pour « Vivace 1,4L A-C AEF » et « 1, 4L anti-chignon » (« 1.4LAC »).
 */
export function potKey(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = normText(String(text).replace(/\\/g, "")).replace(/,/g, ".").replace(/\s+/g, "");
  const m = t.match(/(\d+(?:\.\d+)?)l/);
  if (!m || m.index === undefined) return null;
  const after = t.slice(m.index + m[0].length);
  const ac = /^(a-?c|anti)/.test(after);
  return `${Number(m[1])}L${ac ? "AC" : ""}`;
}

/** Lit la matrice de l'onglet AEF. Retourne les espèces avec prix, et le nombre de lignes écartées. */
export function parseAefRows(matrix: unknown[][]): { rows: AefSpecies[]; skipped: number } {
  const headerIndex = matrix.findIndex(
    (row) =>
      row.some((c) => normText(String(c ?? "")).startsWith("plante")) &&
      row.some((c) => normText(String(c ?? "")).startsWith("prix pro ht")),
  );
  if (headerIndex < 0) return { rows: [], skipped: 0 };

  const header = (matrix[headerIndex] ?? []).map((c) => normText(String(c ?? "")));
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const iSpecies = col("plante");
  const iSize = col("taille de pot");
  const iPrice = col("prix pro ht");
  const iWoo = col("id woocommerce");

  const rows: AefSpecies[] = [];
  let skipped = 0;
  for (const line of matrix.slice(headerIndex + 1)) {
    const species = String(line[iSpecies] ?? "").trim();
    if (species === "") continue;
    const price = parsePrice(line[iPrice]);
    if (price.value == null) {
      skipped += 1;
      continue;
    }
    const size = String(line[iSize] ?? "").trim();
    const woo = String(line[iWoo] ?? "").trim();
    rows.push({
      species,
      size,
      sizeKey: potKey(size),
      proPriceHt: price.value,
      wooId: woo === "" ? null : woo,
    });
  }
  return { rows, skipped };
}
