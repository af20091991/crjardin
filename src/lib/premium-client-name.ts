export interface PremiumClientIdentity {
  name: string;
  civility?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ResolvedPremiumClientIdentity {
  title: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

/**
 * Règle d'identité Premium : civilité → prénom → nom.
 *
 * Les anciens clients peuvent encore avoir un nom stocké sous la forme
 * « Nom Prénom » dans clients.name ; ce format historique est converti ici.
 * Dès que firstName/lastName existent, ils sont la source de vérité.
 */
export function resolvePremiumClientIdentity(
  client: PremiumClientIdentity,
): ResolvedPremiumClientIdentity {
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

  let firstName = client.firstName?.trim() || "";
  let lastName = client.lastName?.trim() || "";

  if (!firstName && !lastName) {
    const name = client.name.trim();
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length === 2 && nameParts[0].toLowerCase() !== "de") {
      lastName = nameParts[0];
      firstName = nameParts[1];
    } else {
      lastName = name;
    }
  }

  const displayName = [title, firstName, lastName].filter(Boolean).join(" ");
  return { title, firstName, lastName, displayName };
}

export function formatPremiumClientName(client: PremiumClientIdentity): string {
  return resolvePremiumClientIdentity(client).displayName;
}
