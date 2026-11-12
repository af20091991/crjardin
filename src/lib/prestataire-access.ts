/**
 * Pages réservées au prestataire (sous-traitant) : il ne voit que les écrans qui le concernent.
 * Toute autre page reste accessible au gérant (admin) et aux observateurs.
 */
export const PRESTATAIRE_ALLOWED_PATHS = [
  "/sst", // Mes missions (Mission SST) et Fiches SST
  "/fiches", // Détail d'une fiche SST (ouvert depuis l'onglet Fiches SST de /sst)
  "/pilot/calendrier", // Calendrier SST
  "/interventions", // CR Chantier
  "/personnalisation", // Personnalisation
  "/pilot/mapping", // Mapping (lecture seule)
] as const;

/** Création de fiche : réservée au gérant, jamais ouverte au prestataire. */
const PRESTATAIRE_DENIED_PATHS = ["/fiches/new"] as const;

export function isPrestatairePathAllowed(pathname: string): boolean {
  if (PRESTATAIRE_DENIED_PATHS.some((d) => pathname === d || pathname.startsWith(`${d}/`))) {
    return false;
  }
  return PRESTATAIRE_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

export const PRESTATAIRE_HOME = "/sst";
