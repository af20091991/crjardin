// Pré-devis — normalisation pure du catalogue fournisseurs (Excel + export Henrri).
// Aucune estimation : une donnée absente ou en erreur reste `null`.

export type PriceStatus = "ok" | "prix_achat_manquant";

export type ParsedPrice = {
  value: number | null;
  status: PriceStatus;
  raw: string | null;
};

export type CatalogueSource = "excel" | "henrri";

/** Texte normalisé pour comparaison (accents, casse, apostrophes, œ). Ne retire aucun mot. */
export function normText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/œ/g, "oe")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Code produit : majuscules, sans espaces, tirets ni points. Le libellé d'origine est gardé ailleurs. */
export function normCode(code: string | null | undefined): string | null {
  if (code == null) return null;
  const c = String(code).toUpperCase().replace(/[\s\-.]/g, "");
  return c.length > 0 ? c : null;
}

/** Désignation normalisée pour rapprochement. « professionnel », dimensions, etc. sont conservés. */
export function normDesignation(designation: string): string {
  return normText(designation);
}

const ERROR_VALUES = /^#(DIV\/0!|REF!|N\/A|VALUE!|NAME\?|NUM!|NULL!)$/i;

/**
 * Lit un prix d'achat. Accepte nombre, « 0,675 », « 1 234,50 », « 12,5 € ».
 * Valeur vide, erreur de tableur ou non numérique → prix manquant (jamais de substitution).
 */
export function parsePrice(raw: unknown): ParsedPrice {
  if (typeof raw === "number") {
    return Number.isFinite(raw)
      ? { value: raw, status: "ok", raw: String(raw) }
      : { value: null, status: "prix_achat_manquant", raw: String(raw) };
  }
  if (raw == null) return { value: null, status: "prix_achat_manquant", raw: null };

  const text = String(raw).trim();
  if (text === "" || ERROR_VALUES.test(text)) {
    return { value: null, status: "prix_achat_manquant", raw: text || null };
  }

  const cleaned = text.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { value: null, status: "prix_achat_manquant", raw: text };
  }
  return { value: Number(cleaned), status: "ok", raw: text };
}

/**
 * Unité canonique. Retourne `null` si l'unité est absente ou inconnue :
 * elle devra être vérifiée/saisie (jamais devinée).
 */
const UNIT_MAP: Record<string, string> = {
  piece: "pièce",
  pieces: "pièce",
  "piece(s)": "pièce",
  unite: "pièce",
  u: "pièce",
  lot: "lot",
  forfait: "forfait",
  heure: "heure",
  h: "heure",
  etage: "étage",
  kg: "kg",
  g: "g",
  t: "tonne",
  tonne: "tonne",
  l: "litre",
  litre: "litre",
  m: "mètre",
  ml: "mètre",
  m2: "m²",
  m3: "m³",
  godet: "godet",
  sac: "sac",
};

export function normUnit(raw: unknown): string | null {
  if (raw == null) return null;
  const key = normText(String(raw)).replace(/\s+/g, "").replace(/²/g, "2").replace(/³/g, "3");
  if (key === "") return null;
  return UNIT_MAP[key] ?? UNIT_MAP[key.replace(/\(s\)$/, "(s)")] ?? null;
}

/** Lignes qui ne sont pas des fournitures catalogue : services et main-d'œuvre (vivent dans les devis). */
export function isCatalogueExcluded(input: { family?: string | null; designation?: string | null; code?: string | null }): boolean {
  const family = normText(input.family ?? "");
  if (family === "services") return true;
  const designation = normText(input.designation ?? "");
  const code = normCode(input.code) ?? "";
  if (/^main[- ]?d ?oeuvre/.test(designation) || /^MO/.test(code)) return true;
  return false;
}

/**
 * Conflit de prix d'achat entre deux sources pour un même produit × fournisseur :
 * la valeur la plus haute est retenue. Une valeur absente ne gagne jamais.
 */
export function resolvePriceConflict(
  current: { value: number | null; source: CatalogueSource },
  incoming: { value: number | null; source: CatalogueSource },
): { value: number | null; source: CatalogueSource; conflict: boolean } {
  if (incoming.value == null) return { ...current, conflict: false };
  if (current.value == null) return { ...incoming, conflict: false };
  const conflict = current.value !== incoming.value;
  return incoming.value > current.value
    ? { ...incoming, conflict }
    : { ...current, conflict };
}

/** Références présentes plusieurs fois (à trancher par l'utilisateur, jamais écrasées silencieusement). */
export function findDuplicateCodes(codes: Array<string | null | undefined>): string[] {
  const seen = new Map<string, number>();
  for (const code of codes) {
    const key = normCode(code);
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}
