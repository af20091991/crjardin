import { sendTransactionalEmailFn } from "@/lib/email/send.functions";

/**
 * Notification des SST concernés par une mise à jour du calendrier.
 * Aucun destinataire n'est ajouté automatiquement : la sélection vient de l'écran.
 */
export interface SstNotifyTarget {
  id: string;
  name: string;
  email: string | null;
}

export interface SstNotifyPayload {
  authorLabel: string;
  dateLabel: string;
  statusLabel: string;
  comment: string | null;
  sheetLabel: string | null;
}

export interface SstNotifyResult {
  sent: number;
  missingEmail: string[];
  failed: string[];
}

export async function notifySubcontractors(
  targets: SstNotifyTarget[],
  payload: SstNotifyPayload,
): Promise<SstNotifyResult> {
  const result: SstNotifyResult = { sent: 0, missingEmail: [], failed: [] };
  for (const target of targets) {
    const email = target.email?.trim();
    if (!email) {
      result.missingEmail.push(target.name);
      continue;
    }
    try {
      await sendTransactionalEmailFn({
        data: {
          templateName: "sst-planning",
          recipientEmail: email,
          templateData: {
            authorLabel: payload.authorLabel,
            dateLabel: payload.dateLabel,
            statusLabel: payload.statusLabel,
            comment: payload.comment ?? "",
            sheetLabel: payload.sheetLabel ?? "",
          },
        },
      });
      result.sent += 1;
    } catch {
      result.failed.push(target.name);
    }
  }
  return result;
}

export function notifySummary(result: SstNotifyResult): string {
  const parts = [`${result.sent} SST notifié${result.sent > 1 ? "s" : ""}`];
  if (result.missingEmail.length > 0) parts.push(`sans e-mail : ${result.missingEmail.join(", ")}`);
  if (result.failed.length > 0) parts.push(`échec : ${result.failed.join(", ")}`);
  return parts.join(" — ");
}
