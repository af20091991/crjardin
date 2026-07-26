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
