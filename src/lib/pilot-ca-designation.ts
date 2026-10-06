// Règles métier de lecture des désignations CA (Pilot Pro v2).
// Les codes prestation peuvent apparaître AVANT ou APRÈS le nom du client :
// ils ne font jamais partie du nom.

export type CaCode = "REE" | "SAP" | "CEEV";

export const CA_CODES: Record<CaCode, { label: string; family: string; note: string }> = {
  REE: {
    label: "Remise en état du jardin",
    family: "sap",
    note: "Particulier → SAP ; résidence ou client professionnel → AP",
  },
  SAP: { label: "Service à la personne", family: "sap", note: "Entretien particulier (SAP)" },
  CEEV: {
    label: "Contrat entretien espaces verts",
    family: "entretien_ev",
    note: "Entretien espaces verts",
  },
};

const PRO_HINTS = [
  "residence", "résidence", "syndic", "sci", "sarl", "sas", "eurl", "copropriete",
  "copropriété", "mairie", "commune", "office", "hlm", "immobiliere", "immobilière",
  "association", "asso", "ehpad", "hotel", "hôtel", "camping", "societe", "société",
];

/** Découpe une désignation CA en { name, codes }. */
export function parseDesignation(raw: string | null | undefined): {
  name: string;
  codes: CaCode[];
  isPro: boolean;
  family: string | null;
  serviceLabel: string | null;
} {
  const input = (raw ?? "").trim();
  const codes: CaCode[] = [];
  let rest = input;
  for (const code of Object.keys(CA_CODES) as CaCode[]) {
    const re = new RegExp(`(^|[^a-zA-Z])${code}([^a-zA-Z]|$)`, "gi");
    if (re.test(rest)) {
      codes.push(code);
      rest = rest.replace(re, " ");
    }
  }
  const name = rest.replace(/[\s\-_/]+/g, " ").replace(/^[\s.,;:]+|[\s.,;:]+$/g, "").trim();
  const lower = input.toLowerCase();
  const isPro = PRO_HINTS.some((h) => lower.includes(h));
  const primary = codes[0] ?? null;
  const family = primary
    ? primary === "REE" && isPro
      ? "amenagement"
      : CA_CODES[primary].family
    : null;
  return {
    name: name || input,
    codes,
    isPro,
    family,
    serviceLabel: primary ? CA_CODES[primary].label : null,
  };
}

/** Nom client probable, débarrassé des codes prestation. */
export function clientNameFromDesignation(raw: string | null | undefined): string {
  return parseDesignation(raw).name;
}

// ---------------------------------------------------------------------------
// Référentiel prestations unique (Pilot Pro v2).
// Liste finale fermée : aucun doublon, aucune variante libre.
// ---------------------------------------------------------------------------

// Référentiel fermé validé par le dirigeant : 4 prestations, ni « Remise en
// état » ni « Autre » ne sont des catégories en vigueur. « Autre » reste
// possible en retour uniquement comme signal « À vérifier » quand aucun
// indice fiable n'existe — jamais comme catégorie affichée.
export const PRESTATIONS = ["SAP", "AP", "CEEV", "Conseil"] as const;
export type Prestation = (typeof PRESTATIONS)[number];
export type PrestationOrAVerifier = Prestation | "Autre";

export const PRESTATION_META: Record<Prestation, { label: string; description: string }> = {
  SAP: { label: "SAP", description: "Service à la personne — entretien chez le particulier" },
  AP: { label: "AP", description: "Aménagement paysager — création, plantation, travaux" },
  CEEV: { label: "CEEV", description: "Contrat d'entretien des espaces verts" },
  Conseil: { label: "Conseil", description: "Conseil, diagnostic, accompagnement" },
};

const AP_HINTS = [
  "amenagement", "aménagement", "creation", "création", "plantation", "planter",
  "massif", "terrasse", "cloture", "clôture", "engazonnement", "gazon", "pose",
  "terrassement", "maconnerie", "maçonnerie", "arrosage", "paysag",
  // Travaux ponctuels = AP (validé dirigeant) : élagage, abattage, dallage…
  "élagage", "elagage", "abattage", "dallage", "graviers", "paillage",
  "conception", "acompte", "cyprès", "photinias", "agrumes", "troènes",
  "arbre", "brf", "toile",
];
const CEEV_HINTS = ["ceev", "contrat", "espaces verts", "espace vert", "entretien annuel"];
// « Ventes HT <mois> 2020 » : agrégats mensuels 2020 sans désignation,
// classés SAP sur décision du dirigeant (entretien particuliers majoritaire).
const SAP_HINTS = ["sap", "tonte", "taille", "entretien", "haie", "desherbage", "désherbage", "ventes ht"];
const CONSEIL_HINTS = ["conseil", "diagnostic", "expertise", "etude", "étude", "visite conseil", "audit"];
// REE : particulier → SAP, professionnel → AP (règle métier existante).
const REE_HINTS = ["remise en etat", "remise en état", "ree", "nettoyage", "debroussaill", "débroussaill"];

// Correspondances clients validées par le dirigeant (aucun indice dans la
// désignation seule) : ne jamais étendre sans validation explicite.
const CLIENT_PRESTATION_MAP: [RegExp, Prestation][] = [
  [/\bsandaya\b/i, "AP"],
  [/\bgestare\b/i, "AP"],
  [/art'?campus/i, "CEEV"],
  [/\bsysco\b/i, "CEEV"],
  [/\byoubee\b/i, "CEEV"],
];

/** Normalise un nom pour la déduction par client (accents/casse/ponctuation). */
function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prestation canonique d'une ligne CA, dans le référentiel fermé à 4
 * prestations. Retourne « Autre » uniquement quand aucun indice fiable
 * n'existe : la ligne doit alors être signalée « À vérifier », jamais
 * présentée comme une catégorie.
 *
 * @param knownByClient map optionnelle nom client normalisé → prestation,
 * construite via buildClientPrestationMap pour déduire les lignes sans
 * indice des autres lignes classées du même client.
 */
export function canonicalPrestation(
  designation: string | null | undefined,
  category?: string | null,
  knownByClient?: Map<string, Prestation>,
): PrestationOrAVerifier {
  const parsed = parseDesignation(designation);
  if (parsed.codes.includes("CEEV")) return "CEEV";
  if (parsed.codes.includes("SAP")) return "SAP";
  if (parsed.codes.includes("REE")) return parsed.isPro ? "AP" : "SAP";

  const raw = designation ?? "";
  // Token « AP » explicite (la frontière de mot exclut « SAP »).
  if (/\bAP\b/.test(raw)) return "AP";

  const hay = `${raw} ${category ?? ""}`.toLowerCase();
  if (CONSEIL_HINTS.some((h) => hay.includes(h))) return "Conseil";
  if (CEEV_HINTS.some((h) => hay.includes(h))) return "CEEV";
  if (REE_HINTS.some((h) => hay.includes(h))) return parsed.isPro ? "AP" : "SAP";
  if (AP_HINTS.some((h) => hay.includes(h))) return "AP";
  if (SAP_HINTS.some((h) => hay.includes(h))) return "SAP";

  for (const [re, p] of CLIENT_PRESTATION_MAP) if (re.test(raw)) return p;

  if (knownByClient) {
    const known = knownByClient.get(normName(parsed.name));
    if (known) return known;
  }
  return "Autre";
}

/**
 * Construit la map nom client normalisé → prestation à partir des lignes
 * déjà classables, pour déduire ensuite les lignes sans indice (même client).
 */
export function buildClientPrestationMap(
  rows: { designation: string | null; category?: string | null }[],
): Map<string, Prestation> {
  const map = new Map<string, Prestation>();
  for (const r of rows) {
    const p = canonicalPrestation(r.designation, r.category);
    if (p === "Autre") continue;
    const name = normName(parseDesignation(r.designation).name);
    if (name.length >= 4 && !map.has(name)) map.set(name, p);
  }
  return map;
}
