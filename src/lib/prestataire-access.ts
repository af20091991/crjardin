/**
 * Pages réservées au prestataire (sous-traitant) : il ne voit que les écrans qui le concernent.
 * Toute autre page reste accessible au gérant (admin) et aux observateurs.
 */
export const PRESTATAIRE_ALLOWED_PATHS = [
  "/sst",
  "/pilot/calendrier",
  "/settings",
  "/personnalisation",
] as const;

export function isPrestatairePathAllowed(pathname: string): boolean {
  return PRESTATAIRE_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

export const PRESTATAIRE_HOME = "/sst";
