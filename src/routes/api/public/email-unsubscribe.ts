import { createFileRoute } from "@tanstack/react-router";

function page(title: string, message: string, status: number) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:24px;font-family:Georgia,serif;background:#F9F7F2;color:#2F3B2A"><main style="max-width:520px;margin:48px auto;text-align:center"><h1 style="font-size:22px">${title}</h1><p style="font-size:16px;line-height:1.5">${message}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Désabonnement des e-mails PilotPro (lien présent dans les e-mails premium).
 * Remplace l'ancien lien hébergé chez Lovable. Ajoute l'adresse à suppressed_emails.
 */
export const Route = createFileRoute("/api/public/email-unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
        if (!/^[a-f0-9]{32,128}$/i.test(token)) {
          return page("Lien invalide", "Ce lien de désabonnement n’est pas valide.", 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as unknown as {
            from: (t: string) => {
              select: (c: string) => {
                eq: (
                  k: string,
                  v: string,
                ) => {
                  maybeSingle: () => Promise<{
                    data: { email: string; used_at: string | null } | null;
                    error: unknown;
                  }>;
                };
              };
              update: (v: object) => { eq: (k: string, v: string) => Promise<unknown> };
              insert: (v: object) => Promise<unknown>;
            };
          };
          const { data: row } = await db
            .from("email_unsubscribe_tokens")
            .select("email, used_at")
            .eq("token", token)
            .maybeSingle();
          if (!row)
            return page(
              "Lien introuvable",
              "Ce lien de désabonnement n’existe pas ou a expiré.",
              404,
            );
          if (!row.used_at) {
            await db
              .from("email_unsubscribe_tokens")
              .update({ used_at: new Date().toISOString() })
              .eq("token", token);
            await db.from("suppressed_emails").insert({
              email: row.email,
              reason: "unsubscribe",
              metadata: { source: "lien e-mail" },
            });
          }
          return page(
            "Désabonnement confirmé",
            "Vous ne recevrez plus d’e-mails de PilotPro à cette adresse.",
            200,
          );
        } catch {
          return page(
            "Erreur",
            "Le désabonnement n’a pas pu être enregistré. Réessayez plus tard.",
            500,
          );
        }
      },
    },
  },
});
