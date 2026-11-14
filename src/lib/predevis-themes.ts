// Pré-devis — thèmes de travaux d'un poste (pur).
// Un poste a un thème principal et, parfois, des thèmes secondaires.
// La détection est une suggestion : l'utilisateur la corrige, et la correction prime.

export const THEMES = [
  "Travaux préparatoires",
  "Mise en place de paillage",
  "Plantation de massif",
  "Plantation de haie",
  "Plantation d'arbre",
  "Gazon alternatif",
  "Goutte-à-goutte",
  "Visites et garantie",
] as const;

export type Theme = (typeof THEMES)[number];

// Mots-clés par thème. L'ordre compte pour le thème principal tiré du titre du poste.
const KEYWORDS: Array<{ theme: Theme; pattern: RegExp }> = [
  { theme: "Gazon alternatif", pattern: /gazon/i },
  { theme: "Goutte-à-goutte", pattern: /goutte|irrigation/i },
  { theme: "Mise en place de paillage", pattern: /paillage|broyat|\bBRF\b/i },
  {
    theme: "Travaux préparatoires",
    pattern:
      /terrassement|nivellement|terre v[ée]g[ée]tale|motoculage|amendement|\bterreau\b|livraison/i,
  },
  { theme: "Visites et garantie", pattern: /visite|garantie|\bSAV\b|fiche conseil|passage à/i },
  { theme: "Plantation de haie", pattern: /haie/i },
  { theme: "Plantation d'arbre", pattern: /arbre|tuteur/i },
  { theme: "Plantation de massif", pattern: /massif|vivace|arbuste|couvre-sol/i },
];

/**
 * Thème principal et thèmes secondaires d'un poste.
 * - principal : premier mot-clé trouvé dans le titre du poste, sinon dans les désignations ;
 * - secondaires : autres thèmes trouvés dans les désignations des lignes.
 */
export function detectThemes(
  title: string,
  designations: string[],
): { main: Theme | null; secondary: Theme[] } {
  const fromTitle = KEYWORDS.find((k) => k.pattern.test(title))?.theme ?? null;
  const all = designations.join(" \n ");
  const found = KEYWORDS.filter((k) => k.pattern.test(all)).map((k) => k.theme);
  const main = fromTitle ?? found[0] ?? null;
  const secondary = found.filter((t) => t !== main);
  return { main, secondary };
}
