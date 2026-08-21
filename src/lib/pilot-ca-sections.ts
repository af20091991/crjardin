// Ordre vertical FIXE et état d'ouverture des encarts de la page
// Chiffre d'affaires. Module purement présentation : aucun calcul métier,
// aucune source de données. L'ordre ci-dessous est la référence unique.

export type CaSectionId = "ventes" | "charges" | "remuneration" | "calculateurs";

/**
 * Ordre imposé à l'écran (après la synthèse/navigation et le tableau
 * « Année complète », qui ne sont pas repliables) :
 * Ventes → Charges → Rémunération → Calculateurs.
 */
export const CA_SECTION_ORDER: CaSectionId[] = [
  "ventes",
  "charges",
  "remuneration",
  "calculateurs",
];

export const CA_SECTION_LABELS: Record<CaSectionId, string> = {
  ventes: "Ventes",
  charges: "Charges",
  remuneration: "Rémunération",
  calculateurs: "Calculateurs",
};

export type CaSectionState = Record<CaSectionId, boolean>;

/** État initial : tous les encarts sont FERMÉS. */
export const CA_SECTIONS_CLOSED: CaSectionState = {
  ventes: false,
  charges: false,
  remuneration: false,
  calculateurs: false,
};

export const CA_SECTIONS_KEY = "pilot-ca-sections";

/** Lecture tolérante du réglage mémorisé : toute valeur inconnue est ignorée. */
export function parseCaSections(raw: string | null | undefined): CaSectionState {
  const state: CaSectionState = { ...CA_SECTIONS_CLOSED };
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const id of CA_SECTION_ORDER) {
      if (parsed && typeof parsed[id] === "boolean") state[id] = parsed[id] as boolean;
    }
  } catch {
    /* réglage illisible : on repart de « tout fermé » */
  }
  return state;
}

export function serializeCaSections(state: CaSectionState): string {
  return JSON.stringify(
    CA_SECTION_ORDER.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = !!state[id];
      return acc;
    }, {}),
  );
}

/** Bascule d'un seul encart : les autres conservent strictement leur état. */
export function toggleCaSection(state: CaSectionState, id: CaSectionId): CaSectionState {
  return { ...state, [id]: !state[id] };
}
