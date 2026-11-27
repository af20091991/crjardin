// Mail de rappel d'intervention envoyé au client (modèle validé le 27/11/2026).
// Pure fonction : aucun envoi ici. Utilisé par l'alerte qui vous est envoyée.

export const RAPPEL_SENDER = "client@delagraineaujardin.com";
export const RAPPEL_SITE_NAME = "De la graine au jardin";

export interface ClientRappelInput {
  clientName: string; // ex. "Pouchain"
  dateLabel: string; // ex. "jeudi 3 décembre 2026"
  timeLabel: string; // ex. "7h30"
  works: string[]; // ex. ["Souffleur", "Massifs", "Taille"]
  premiumUrl: string; // lien privé vers l'espace client Premium
}

export interface ClientRappelMail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
  );

const SIGNATURE_LOGO =
  "https://www.delagraineaujardin.com/wp-content/uploads/2025/05/Logo-mail-2025-png.png";

export function buildClientRappelMail(input: ClientRappelInput): ClientRappelMail {
  const when = `le ${input.dateLabel} à ${input.timeLabel}`;
  const subject = `Rappel : intervention jardin ${when}`;
  const works = input.works.filter(Boolean);

  const text = [
    `Bonjour, Madame, Monsieur ${input.clientName},`,
    "",
    `Je tenais à vous confirmer mon intervention dans votre jardin ${when}.`,
    "",
    "Voici les travaux prévus lors de cette intervention :",
    ...works.map((w) => `- ${w}`),
    "",
    `Je vous invite à consulter le planning d'entretien disponible dans votre espace client Premium (${input.premiumUrl}) pour plus de détails concernant les travaux envisagés.`,
    "",
    "Pour toute question ou pour nous signaler un empêchement, répondez simplement à ce message.",
    "",
    "Par ailleurs, je vous invite à me notifier de tout élément pouvant nécessiter des travaux complémentaires en fonction de votre besoin afin que je puisse m'organiser en amont de ma venue.",
    "",
    "Dans l'attente de notre rendez-vous, je vous souhaite une agréable journée et reste bien entendu disponible pour répondre à vos questions si vous en avez.",
    "",
    "Jardinement vôtre,",
    "Anthony Fournier",
    "De la graine au jardin",
    "https://www.delagraineaujardin.com",
  ].join("\n");

  const html = `<table style="font-family: Calibri, Carlito, Arial, sans-serif; font-size: 15px; color: #2F2F2F; max-width: 600px; border-collapse: collapse;"><tr><td style="padding-bottom: 20px;"><img src="${SIGNATURE_LOGO}" alt="${esc(RAPPEL_SITE_NAME)} - Logo" width="120" style="display: block; border: 0;"></td></tr><tr><td style="padding-bottom: 16px; line-height: 1.55; font-family: Calibri, Carlito, Arial, sans-serif; font-size: 15px;"><p style="margin: 0 0 14px 0;">Bonjour, Madame, Monsieur ${esc(input.clientName)},</p><p style="margin: 0 0 14px 0;">Je tenais à vous confirmer mon intervention dans votre jardin <strong><u>${esc(when)}</u></strong>.</p><p style="margin: 0 0 6px 0;">Voici les travaux prévus lors de cette intervention :</p><ul style="margin: 0 0 14px 0; padding-left: 22px;">${works.map((w) => `<li>${esc(w)}</li>`).join("")}</ul><p style="margin: 0 0 14px 0;">Je vous invite à consulter le planning d'entretien disponible dans votre <a href="${esc(input.premiumUrl)}" style="color: #3B5323;">espace client Premium</a> pour plus de détails concernant les travaux envisagés.</p><p style="margin: 0 0 14px 0;">Pour toute question ou pour nous signaler un empêchement, répondez simplement à ce message.</p><p style="margin: 0 0 14px 0;">Par ailleurs, je vous invite à me notifier de tout élément pouvant nécessiter des travaux complémentaires en fonction de votre besoin afin que je puisse m'organiser en amont de ma venue.</p><p style="margin: 0 0 14px 0;">Dans l'attente de notre rendez-vous, je vous souhaite une agréable journée et reste bien entendu disponible pour répondre à vos questions si vous en avez.</p></td></tr><tr><td><table style="font-family: Calibri, Carlito, Arial, sans-serif; font-size: 14px; color: #2F2F2F; max-width: 480px; border-collapse: collapse;"><tr><td style="background-color: #F9F9F9; border-left: 4px solid #6B8E23; border-radius: 8px; padding: 14px 16px;"><table style="border-collapse: collapse;"><tr><td style="padding-right: 14px; vertical-align: top;"><img src="${SIGNATURE_LOGO}" alt="${esc(RAPPEL_SITE_NAME)} - Logo" width="88" height="88" style="display: block; border-radius: 6px;"></td><td style="vertical-align: top;"><div style="font-size: 16px; font-weight: bold; color: #2F4F2F;">Anthony Fournier</div><div style="color: #3B5323; font-weight: bold; margin-bottom: 2px;">Paysagiste-conseil</div><div style="font-style: italic; color: #555555; font-size: 14px; margin-bottom: 8px;">Conseil, conception &amp; accompagnement de jardins secs</div><a href="https://www.delagraineaujardin.com/conseil-jardin/" style="display: inline-block; background-color: #4C7031; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 7px 14px; border-radius: 4px; margin-bottom: 10px;">🌿 Demander une visite conseil</a><div style="height: 1px; background-color: #DADADA; margin: 8px 0;"></div><div style="line-height: 1.6; font-size: 14px; color: #2F2F2F;">📍 Montpellier et alentours<br>📞 <a href="tel:+33769990345" style="color: #3B5323; text-decoration: none;">07 69 99 03 45</a><br>✉️ <a href="mailto:contact@delagraineaujardin.com" style="color: #3B5323; text-decoration: none;">contact@delagraineaujardin.com</a><br>📝 <a href="https://www.delagraineaujardin.com/blog-jardin/" style="color: #3B5323; text-decoration: none;">Blog : astuces &amp; conseils</a></div></td></tr></table></td></tr></table></td></tr></table>`;

  return { subject, html, text };
}

export function splitWorks(title: string): string[] {
  return title
    .split("·")
    .map((w) => w.trim())
    .filter(Boolean);
}
