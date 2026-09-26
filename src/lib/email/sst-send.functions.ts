import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  recipientEmail: z.string().email(),
  templateData: z.record(z.string(), z.unknown()),
});

export const sendSstWorksiteSheetEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const { sendReportEmail } = await import("./report-send.server");
    return sendReportEmail({
      templateName: "sst-worksite-sheet",
      recipientEmail: data.recipientEmail,
      templateData: data.templateData,
      idempotencyKey: `sst-worksite-sheet-${data.recipientEmail}-${crypto.randomUUID()}`,
    });
  });
