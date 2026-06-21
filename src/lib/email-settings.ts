import { supabase } from "@/integrations/supabase/client";

export interface EmailSettings {
  key: string;
  subject: string;
  body: string;
}

export const EMAIL_TOKENS = {
  titre: "[titre]",
  nom: "[nom de famille]",
  date: "[date intervention]",
  lien: "[lien secret fiche client]",
} as const;

/** Marker kept in the rendered body so the email template can inject a real link. */
export const LINK_MARKER = "{{LIEN}}";

const DEFAULT: EmailSettings = {
  key: "new-report",
  subject: "Votre compte-rendu de jardinage est disponible",
  body: "",
};

export async function getEmailSettings(): Promise<EmailSettings> {
  const { data, error } = await supabase
    .from("email_settings")
    .select("key, subject, body")
    .eq("key", "new-report")
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT;
}

export async function updateEmailSettings(input: { subject: string; body: string }): Promise<void> {
  const { error } = await supabase
    .from("email_settings")
    .update({ subject: input.subject, body: input.body })
    .eq("key", "new-report");
  if (error) throw error;
}

/** Replace the personalisation tokens, keeping the link token as a renderable marker. */
export function fillTemplate(
  body: string,
  values: { titre: string; nom: string; date: string },
): string {
  return body
    .split(EMAIL_TOKENS.titre).join(values.titre)
    .split(EMAIL_TOKENS.nom).join(values.nom)
    .split(EMAIL_TOKENS.date).join(values.date)
    .split(EMAIL_TOKENS.lien).join(LINK_MARKER);
}
