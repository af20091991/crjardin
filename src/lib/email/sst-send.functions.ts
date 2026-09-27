import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  recipientEmail: z.string().email(),
  templateData: z.record(z.string(), z.unknown()),
});

const recipientLookupSchema = z.object({ names: z.array(z.string().min(1)).max(20) });


function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

export const resolveSstRecipientEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(recipientLookupSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "prestataire");

    if (rolesError) throw rolesError;

    const prestataireIds = new Set((roles ?? []).map((row) => row.user_id));
    if (!prestataireIds.size) {
      return data.names.map((name) => ({ name, email: null as string | null }));
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(prestataireIds));

    if (profilesError) throw profilesError;

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (usersError) throw usersError;

    const emailById = new Map(
      users.users
        .filter((user) => prestataireIds.has(user.id) && user.email)
        .map((user) => [user.id, user.email!.trim()]),
    );

    return data.names.map((name) => {
      const normalized = normalizeName(name);
      const exact = (profiles ?? []).find(
        (profile) => normalizeName(profile.display_name ?? "") === normalized,
      );
      const startsWith = (profiles ?? []).find((profile) =>
        normalizeName(profile.display_name ?? "").startsWith(normalized + " "),
      );
      const profile = exact ?? startsWith;

      return {
        name,
        email: profile ? (emailById.get(profile.id) ?? null) : null,
      };
    });
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
