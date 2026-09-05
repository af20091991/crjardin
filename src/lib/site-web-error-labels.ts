// Traduction des codes d'erreur techniques du module Site web en messages lisibles.
// Présentation uniquement : aucun code d'erreur n'est masqué, il est reformulé.

const LABELS: Record<string, string> = {
  unauthorized: "Session Pilot Pro expirée : reconnectez-vous puis réessayez.",
  google_oauth_not_configured:
    "La connexion Google n'est pas encore configurée côté serveur.",
  google_token_unavailable:
    "Aucune autorisation Google valide : reconnectez le compte Google.",
  invalid_state: "La demande de connexion Google a expiré : relancez la connexion.",
  business_profile_accounts_failed:
    "Google n'a pas renvoyé la liste des comptes de la fiche d'établissement.",
  business_profile_locations_failed:
    "Google n'a pas renvoyé les fiches d'établissement de ce compte.",
  business_profile_performance_failed:
    "Google n'a pas renvoyé les statistiques de la fiche d'établissement.",
  search_console_sites_failed: "Google n'a pas renvoyé la liste des sites Search Console.",
  search_analytics_failed: "Google n'a pas renvoyé les données de recherche du site.",
  analytics_properties_failed: "Google n'a pas renvoyé la liste des propriétés Analytics.",
  analytics_report_failed: "Google n'a pas renvoyé le rapport de fréquentation.",
  missing_parameters: "Une information nécessaire à la requête Google est absente.",
  unknown_action: "Action non reconnue par le service Site web.",
};

const HINTS: Array<{ match: RegExp; hint: string }> = [
  {
    match: /RESOURCE_EXHAUSTED|quota/i,
    hint: "Google limite encore ce projet : l'accès aux API doit être validé.",
  },
  { match: /PERMISSION_DENIED|403/, hint: "Ce compte Google n'a pas les droits nécessaires." },
  { match: /NOT_FOUND|404/, hint: "L'élément demandé n'existe pas pour ce compte Google." },
];

/** Rend un message d'erreur compréhensible sans perdre l'information technique. */
export function describeSiteWebError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Erreur inconnue du service Site web.";

  const code = trimmed.split(/\s+—\s+/)[0]?.trim() ?? trimmed;
  const label = LABELS[code];
  const hint = HINTS.find(({ match }) => match.test(trimmed))?.hint;

  if (label && hint) return `${label} ${hint}`;
  if (label) return label;
  if (hint) return hint;
  return trimmed;
}
