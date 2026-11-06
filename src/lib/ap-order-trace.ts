// Journal des envois de commandes fournisseur (Assistant AP).
import { supabase } from "@/integrations/supabase/client";

export interface ApOrderSend {
  id: string;
  worksite_id: string | null;
  worksite_label: string;
  supplier_name: string;
  recipient_email: string;
  status: "sent" | "suppressed" | "failed";
  error_message: string | null;
  sent_at: string;
}

// Table hors types générés courants : même accès que le reste de l'Assistant AP.
const apFrom = (table: string) => (supabase.from as any)(table);

export async function listApOrderSends(worksiteId: string): Promise<ApOrderSend[]> {
  const { data, error } = await apFrom("ap_order_sends")
    .select(
      "id, worksite_id, worksite_label, supplier_name, recipient_email, status, error_message, sent_at",
    )
    .eq("worksite_id", worksiteId)
    .order("sent_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ApOrderSend[];
}
