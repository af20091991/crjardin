// ---------------------------------------------------------------------------
// Centre de nettoyage du référentiel client.
// RÈGLE ABSOLUE : aucune fusion ni suppression automatique. Ce module se
// contente de SIGNALER les fiches dont le nom ressemble à une prestation ou à
// un chantier, pour validation humaine dans l'écran Fiches clients.
// ---------------------------------------------------------------------------

/** Termes de prestation ou de chantier qui ne sont jamais un nom de client. */
export const SERVICE_TERMS = [
  "tonte",
  "taille",
  "élagage",
  "elagage",
  "abattage",
  "débroussaillage",
  "debroussaillage",
  "plantation",
  "arrosage",
  "engazonnement",
  "gazon",
  "haie",
  "chantier",
  "entretien",
  "nettoyage",
  "évacuation",
  "evacuation",
  "déchets",
  "dechets",
  "terrassement",
  "clôture",
  "cloture",
  "massif",
  "désherbage",
  "desherbage",
  "broyage",
  "devis",
  "acompte",
  "facture",
  "divers",
  "materiel",
  "matériel",
  "fourniture",
  "location",
  "prestation",
  "remise",
] as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SuspectReason {
  /** Terme détecté dans le nom de la fiche. */
  term: string;
  /** Explication affichée à l'utilisateur. */
  label: string;
}

/**
 * Le nom de la fiche ressemble-t-il à une prestation / un chantier ?
 * Retourne `null` si la fiche est un nom de client plausible.
 */
export function suspectReason(name: string): SuspectReason | null {
  const n = normalize(name);
  if (!n) return { term: "", label: "Nom vide" };
  for (const term of SERVICE_TERMS) {
    const t = normalize(term);
    if (n === t || n.includes(` ${t}`) || n.startsWith(`${t} `) || n.includes(`${t} `)) {
      return { term, label: `Le nom contient « ${term} » : intitulé de prestation probable` };
    }
  }
  if (/^\d/.test(n)) return { term: "", label: "Le nom commence par un chiffre" };
  return null;
}

export interface SuspectClient<T extends { id: string; name: string }> {
  client: T;
  reason: SuspectReason;
  /** Fiche client existante la plus probable pour un rattachement. */
  suggestion: T | null;
}

/**
 * Liste des fiches à valider humainement, avec une suggestion de rattachement
 * calculée sur le préfixe du nom (jamais appliquée automatiquement).
 */
export function findSuspectClients<T extends { id: string; name: string }>(clients: T[]): SuspectClient<T>[] {
  const clean = clients.filter((c) => suspectReason(c.name) == null);
  const out: SuspectClient<T>[] = [];
  for (const c of clients) {
    const reason = suspectReason(c.name);
    if (!reason) continue;
    const n = normalize(c.name);
    let suggestion: T | null = null;
    let best = 0;
    for (const candidate of clean) {
      const cn = normalize(candidate.name);
      if (cn.length < 4) continue;
      if (n.startsWith(cn) || n.includes(` ${cn}`) || n.includes(`${cn} `)) {
        if (cn.length > best) {
          best = cn.length;
          suggestion = candidate;
        }
      }
    }
    out.push({ client: c, reason, suggestion });
  }
  return out.sort((a, b) => a.client.name.localeCompare(b.client.name, "fr"));
}
