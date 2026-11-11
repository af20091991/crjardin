// Charte graphique « De la graine au jardin » pour tous les PDF générés.
// Valeurs relevées sur la palette officielle du logo (relevé visuel, à confirmer au besoin).
// Source unique : toute évolution de la charte se fait ici.

export type RgbTuple = [number, number, number];

export const PDF_BRAND = {
  /** Vert typo du nom (= primary de l'application). */
  green: [79, 142, 51] as RgbTuple,
  /** Vert logo (feuille principale). */
  greenLogo: [75, 170, 53] as RgbTuple,
  /** Orange logo. */
  orange: [238, 134, 39] as RgbTuple,
  /** Marron logo (terre). */
  brown: [133, 90, 65] as RgbTuple,
  /** Jaune logo. */
  yellow: [237, 224, 35] as RgbTuple,
  /** Bleu logo (filet). */
  blue: [46, 141, 204] as RgbTuple,
  /** Couleur de cerclage du logo. */
  ring: [114, 48, 15] as RgbTuple,
  /** Mention « paysagiste ». */
  ink: [68, 68, 68] as RgbTuple,
  /** Texte courant et filets neutres. */
  dark: [48, 55, 45] as RgbTuple,
  muted: [112, 116, 106] as RgbTuple,
  line: [221, 226, 215] as RgbTuple,
  surface: [247, 249, 243] as RgbTuple,
} as const;

export const PDF_BRAND_FOOTER_NAME = "De la graine au jardin";
