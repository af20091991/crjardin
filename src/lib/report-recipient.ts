// Destinataire d'un compte-rendu (PP v2.3+).
// Règle métier : le CONTACT est la personne, le SITE est le lieu.
// Interdiction absolue d'écrire « Madame/Monsieur + nom de lieu ».

import { looksLikePlace } from "@/lib/sites";

export interface RecipientSource {
  /** Civilité du client ou du contact. */
  civility?: string | null;
  /** Nom du client (peut être un lieu sur les fiches historiques). */
  name?: string | null;
  /** Contact identifié : prioritaire sur le nom du client. */
  contact?: { civility?: string | null; display_name?: string | null } | null;
}

export interface Recipient {
  /** Ligne d'adressage : « Madame Bodard » ou, à défaut, le lieu sans civilité. */
  line: string;
  /** Formule d'appel : « Bonjour Madame Bodard, » ou « Bonjour, ». */
  salutation: string;
  /** Vrai quand aucune personne n'est identifiée : le CR n'utilise alors aucune civilité. */
  isPlaceOnly: boolean;
}

export function reportRecipient(source: RecipientSource, fallback = ""): Recipient {
  const contactName = source.contact?.display_name?.trim();
  if (contactName && !looksLikePlace(contactName)) {
    const civ = source.contact?.civility?.trim() ?? source.civility?.trim() ?? "";
    const line = [civ, contactName].filter(Boolean).join(" ");
    return { line, salutation: `Bonjour ${line},`, isPlaceOnly: false };
  }

  const name = source.name?.trim() ?? "";
  if (name && !looksLikePlace(name)) {
    const line = [source.civility?.trim(), name].filter(Boolean).join(" ");
    return { line, salutation: `Bonjour ${line},`, isPlaceOnly: false };
  }

  // Nom de lieu (résidence, copropriété…) : jamais de civilité devant.
  const line = name || fallback;
  return { line, salutation: "Bonjour,", isPlaceOnly: true };
}