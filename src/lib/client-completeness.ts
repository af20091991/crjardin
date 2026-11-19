// Fiche client complète : liste unique des éléments à compléter, pour la fiche et l'espace Premium.
// Fonction pure : aucune lecture ni écriture ici.

export type CompletenessAction =
  | { kind: "edit" }
  | { kind: "gestion"; tab: "interventions" | "reco" }
  | { kind: "premium"; section: "cover" | "calendar" | "note" | null };

export interface CompletenessItem {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
  scope: "fiche" | "premium";
  action: CompletenessAction;
}

export interface CompletenessInput {
  client: {
    email: string | null;
    emails?: unknown;
    phone: string | null;
    address: string | null;
    contract_type: string | null;
    frequency: string | null;
    ceev_planning_path: string | null;
  };
  premiumEnabled: boolean;
  premium: {
    cover_photo_id: string | null;
    cover_document_id: string | null;
    commercial_note: string | null;
    google_review_url: string | null;
  } | null;
  workCalendarCount: number;
  interventionCount: number;
  recoCount: number;
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

export function buildCompleteness(input: CompletenessInput): {
  items: CompletenessItem[];
  missing: CompletenessItem[];
  done: number;
  total: number;
} {
  const { client, premium } = input;
  const hasEmails = Array.isArray(client.emails) && client.emails.length > 0;
  const isEntretien = /entretien/i.test(client.contract_type ?? "");

  const items: CompletenessItem[] = [
    {
      id: "email",
      label: "Adresse e-mail",
      done: filled(client.email) || hasEmails,
      required: true,
      scope: "fiche",
      action: { kind: "edit" },
    },
    {
      id: "phone",
      label: "Téléphone",
      done: filled(client.phone),
      required: true,
      scope: "fiche",
      action: { kind: "edit" },
    },
    {
      id: "address",
      label: "Adresse du jardin",
      done: filled(client.address),
      required: true,
      scope: "fiche",
      action: { kind: "edit" },
    },
    {
      id: "contract",
      label: "Type de contrat",
      done: filled(client.contract_type),
      required: true,
      scope: "fiche",
      action: { kind: "edit" },
    },
    {
      id: "frequency",
      label: "Fréquence d'entretien",
      done: filled(client.frequency),
      required: false,
      scope: "fiche",
      action: { kind: "edit" },
    },
    {
      id: "planning",
      label: "Planning PDF d'entretien annuel",
      done: filled(client.ceev_planning_path),
      required: isEntretien,
      scope: "fiche",
      action: { kind: "edit" },
    },
    {
      id: "intervention",
      label: "Au moins une intervention",
      done: input.interventionCount > 0,
      required: true,
      scope: "fiche",
      action: { kind: "gestion", tab: "interventions" },
    },
    {
      id: "reco",
      label: "Préconisations rédigées",
      done: input.recoCount > 0,
      required: false,
      scope: "fiche",
      action: { kind: "gestion", tab: "reco" },
    },
    {
      id: "premium_active",
      label: "Espace Premium activé",
      done: input.premiumEnabled,
      required: false,
      scope: "fiche",
      action: { kind: "premium", section: null },
    },
  ];

  if (input.premiumEnabled) {
    items.push(
      {
        id: "calendar",
        label: "Calendrier travaux importé",
        done: input.workCalendarCount > 0,
        required: true,
        scope: "premium",
        action: { kind: "premium", section: "calendar" },
      },
      {
        id: "cover",
        label: "Photo de couverture",
        done: Boolean(premium?.cover_photo_id || premium?.cover_document_id),
        required: false,
        scope: "premium",
        action: { kind: "premium", section: "cover" },
      },
      {
        id: "note",
        label: "Note commerciale",
        done: filled(premium?.commercial_note),
        required: false,
        scope: "premium",
        action: { kind: "premium", section: "note" },
      },
      {
        id: "google",
        label: "Lien avis Google",
        done: filled(premium?.google_review_url),
        required: false,
        scope: "premium",
        action: { kind: "premium", section: "note" },
      },
    );
  }

  const missing = items.filter((item) => !item.done);
  return {
    items,
    missing,
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}
