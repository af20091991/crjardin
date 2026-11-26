// Assistant AP — envoi des commandes par e-mail aux fournisseurs : TERRAIN PRÉPARÉ, NON ACTIVÉ.
// Aucun appel réseau ici. Pour activer plus tard : passer AP_SUPPLIER_EMAIL_ENABLED à true,
// puis brancher une serverFn d'envoi (sendTemplateEmail) sur buildSupplierEmail().
import type { ApSupplierOrder } from "@/lib/assistant-ap-export";
import { buildOrderText } from "@/lib/assistant-ap-export";
import type { ApWorksite } from "@/lib/assistant-ap";

export const AP_SUPPLIER_EMAIL_ENABLED = false;

export interface ApSupplierEmailDraft {
  to: string | null;
  subject: string;
  body: string;
}

export function buildSupplierEmail(
  worksite: Pick<ApWorksite, "scheduled_date" | "date_label">,
  order: ApSupplierOrder,
  supplierEmail: string | null,
): ApSupplierEmailDraft {
  return {
    to: supplierEmail?.trim() || null,
    subject: `Commande de fournitures — ${order.supplier}`,
    body: `Bonjour,\n\nVoici notre commande de fournitures :\n\n${buildOrderText(worksite, [order])}\n\nMerci de nous confirmer la disponibilité.\n\nCordialement,\nDe la graine au jardin`,
  };
}
