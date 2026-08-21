// Envoi du compte-rendu au client : états explicites et boucle reprenable.
//
// RÈGLE : un e-mail accepté par la file d'envoi ne doit JAMAIS être renvoyé
// parce que sa journalisation a échoué. La boucle est donc reprenable
// destinataire par destinataire, et l'échec de journalisation produit un état
// de reprise explicite (aucun second envoi).

export type ReportSendStatus =
  | "brouillon"
  | "archive_indisponible"
  | "aucun_destinataire"
  | "lien_invalide"
  | "pret"
  | "envoi_en_cours"
  | "envoye"
  | "reprise_journalisation"
  | "consulte"
  | "echec";

export const REPORT_SEND_LABELS: Record<ReportSendStatus, string> = {
  brouillon: "Compte-rendu non terminé",
  archive_indisponible: "Archive PDF indisponible",
  aucun_destinataire: "Aucune adresse e-mail",
  lien_invalide: "Lien de partage invalide",
  pret: "Prêt à envoyer",
  envoi_en_cours: "Envoi en cours…",
  envoye: "Envoyé au client",
  reprise_journalisation: "Envoyé — journalisation à reprendre",
  consulte: "Consulté par le client",
  echec: "Échec d'envoi",
};

export interface ReportSendContext {
  done: boolean;
  pdfStoragePath: string | null | undefined;
  shareToken: string | null | undefined;
  recipients: string[];
  sentToClientAt: string | null | undefined;
  clientReadAt: string | null | undefined;
  sending?: boolean;
  /** Résultat du dernier envoi tenté dans la session. */
  lastOutcome?: SendOutcome | null;
}

/** Les blocages sont évalués avant tout envoi, dans un ordre stable. */
export function reportSendBlocker(ctx: ReportSendContext): ReportSendStatus | null {
  if (!ctx.done) return "brouillon";
  if (!ctx.pdfStoragePath) return "archive_indisponible";
  if (ctx.recipients.length === 0) return "aucun_destinataire";
  if (!ctx.shareToken) return "lien_invalide";
  return null;
}

export function reportSendStatus(ctx: ReportSendContext): ReportSendStatus {
  if (ctx.sending) return "envoi_en_cours";
  const blocker = reportSendBlocker(ctx);
  if (blocker) return blocker;
  const outcome = ctx.lastOutcome;
  if (outcome) {
    if (outcome.failed.length > 0) return "echec";
    if (outcome.logPending.length > 0) return "reprise_journalisation";
  }
  if (ctx.clientReadAt) return "consulte";
  if (ctx.sentToClientAt) return "envoye";
  return "pret";
}

/** Vrai seulement quand rien ne bloque et qu'aucun envoi n'est en cours. */
export function canSendReport(ctx: ReportSendContext): boolean {
  const status = reportSendStatus(ctx);
  return status !== "envoi_en_cours" && reportSendBlocker(ctx) === null;
}

/** Lien de partage ciblant précisément le compte-rendu concerné. */
export function reportShareUrl(origin: string, shareToken: string, interventionId: string): string {
  return `${origin}/partage/${shareToken}?intervention=${encodeURIComponent(interventionId)}`;
}

/**
 * Clé d'idempotence stable : identique tant que l'archive envoyée n'a pas
 * changé, donc un renvoi accidentel ne produit pas de doublon, tandis qu'une
 * nouvelle archive autorise un envoi volontaire.
 */
export function reportIdempotencyKey(
  interventionId: string,
  recipient: string,
  pdfStoragePath: string,
): string {
  const archiveKey = pdfStoragePath.replace(/[^a-zA-Z0-9]/g, "").slice(-24);
  return `new-report-${interventionId}-${recipient.toLowerCase()}-${archiveKey}`;
}

export interface SendOutcome {
  /** Destinataires envoyés ET journalisés. */
  sent: string[];
  /** Envoyés mais journalisation en échec : ne JAMAIS renvoyer. */
  logPending: string[];
  /** Envoi refusé : reprenable au prochain essai. */
  failed: { recipient: string; message: string }[];
}

export interface SendDeps {
  sendEmail: (recipient: string, idempotencyKey: string) => Promise<void>;
  logSent: (recipient: string) => Promise<void>;
  /** Appelé seulement si au moins un e-mail a été accepté par la file. */
  markSent: () => Promise<void>;
}

/**
 * Boucle reprenable : chaque destinataire est traité indépendamment.
 * `alreadySent` (destinataires déjà acceptés lors d'une tentative précédente)
 * est ignoré pour éviter tout doublon.
 */
export async function sendReportToRecipients(
  deps: SendDeps,
  params: {
    interventionId: string;
    pdfStoragePath: string;
    recipients: string[];
    alreadySent?: string[];
  },
): Promise<SendOutcome> {
  const skip = new Set((params.alreadySent ?? []).map((r) => r.toLowerCase()));
  const outcome: SendOutcome = { sent: [], logPending: [], failed: [] };
  let anyAccepted = false;

  for (const recipient of params.recipients) {
    if (skip.has(recipient.toLowerCase())) continue;
    try {
      await deps.sendEmail(
        recipient,
        reportIdempotencyKey(params.interventionId, recipient, params.pdfStoragePath),
      );
    } catch (e) {
      outcome.failed.push({
        recipient,
        message: e instanceof Error ? e.message : "Envoi refusé",
      });
      continue;
    }
    anyAccepted = true;
    try {
      await deps.logSent(recipient);
      outcome.sent.push(recipient);
    } catch {
      // E-mail bien accepté : on retient la reprise de journalisation,
      // jamais un nouvel envoi.
      outcome.logPending.push(recipient);
    }
  }

  if (anyAccepted) {
    try {
      await deps.markSent();
    } catch {
      outcome.logPending.push(...outcome.sent.filter((r) => !outcome.logPending.includes(r)));
    }
  }
  return outcome;
}

/** Message utilisateur unique et sans ambiguïté après une tentative. */
export function sendOutcomeMessage(outcome: SendOutcome): string {
  const parts: string[] = [];
  if (outcome.sent.length > 0) parts.push(`${outcome.sent.length} e-mail(s) envoyé(s)`);
  if (outcome.logPending.length > 0)
    parts.push(`${outcome.logPending.length} envoyé(s) mais non journalisé(s) — ne pas renvoyer`);
  if (outcome.failed.length > 0) parts.push(`${outcome.failed.length} échec(s) à reprendre`);
  return parts.length > 0 ? parts.join(" · ") : "Aucun envoi nécessaire";
}

/**
 * Reprise : rejoue UNIQUEMENT la journalisation et le marquage d'envoi pour
 * des destinataires dont l'e-mail a déjà été accepté par la file. Aucun
 * nouvel e-mail n'est jamais émis ici — c'est l'unique chemin de reprise.
 */
export async function resumeReportLogging(
  deps: Pick<SendDeps, "logSent" | "markSent">,
  params: { recipients: string[] },
): Promise<SendOutcome> {
  const outcome: SendOutcome = { sent: [], logPending: [], failed: [] };
  if (params.recipients.length === 0) return outcome;

  for (const recipient of params.recipients) {
    try {
      await deps.logSent(recipient);
      outcome.sent.push(recipient);
    } catch {
      outcome.logPending.push(recipient);
    }
  }

  try {
    await deps.markSent();
  } catch {
    // Le marquage d'envoi reste à reprendre : tout redevient "à journaliser",
    // sans jamais relancer d'e-mail.
    outcome.logPending = [...params.recipients];
    outcome.sent = [];
  }
  return outcome;
}
