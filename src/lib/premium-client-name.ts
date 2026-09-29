export interface PremiumClientIdentity {
  name: string;
  civility?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Identité affichée partout dans l'espace Premium.
 *
 * Règle métier : civilité → prénom → nom.
 * Les anciens clients peuvent encore avoir un nom stocké sous la forme
 * « Nom Prénom » dans clients.name ; ce format historique est converti ici.
 * Les nouvelles données disposant de firstName/lastName utilisent toujours
 * ces champs comme source de vérité.
 */
export function formatPremiumClientName(client: PremiumClientIdentity): string {
  const civility = client.civility?.trim().toLowerCase();
  let title = client.civility?.trim() || "";

  if (
    civility === "madame et monsieur" ||
    civility === "monsieur et madame" ||
    civility === "mme et m." ||
    civility === "m. et mme"
  ) {
    title = "Madame et Monsieur";
  } else if (civility === "madame" || civility === "mme" || civility === "mrs") {
    title = "Madame";
  } else if (civility === "monsieur" || civility === "m." || civility === "mr") {
    title = "Monsieur";
  }

  const firstName = client.firstName?.trim() || "";
  const lastName = client.lastName?.trim() || "";
  if (firstName || lastName) {
    return [title, firstName, lastName].filter(Boolean).join(" ");
  }

  const name = client.name.trim();
  const nameParts = name.split(/\s+/).filter(Boolean);
  if (nameParts.length === 2 && nameParts[0].toLowerCase() !== "de") {
    return [title, nameParts[1], nameParts[0]].filter(Boolean).join(" ");
  }

  return [title, name].filter(Boolean).join(" ");
}
