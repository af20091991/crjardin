// Rappel d'intervention envoyé au client 48 h avant le jour J.
//
// ➜ POUR PERSONNALISER LE MAIL : modifiez uniquement le bloc RAPPEL_CONFIG ci-dessous
//   (nom de l'entreprise, signature, téléphone, adresse de réponse) et le texte
//   de buildRappelMail (formulations). Les couleurs viennent de src/lib/pdf-brand.ts.

import { PDF_BRAND } from "@/lib/pdf-brand";

export const RAPPEL_CONFIG = {
  companyName: "De la graine au jardin",
  signature: "L'équipe De la graine au jardin",
  phone: "", // ex. "04 00 00 00 00" — laisser vide pour ne pas l'afficher
  replyEmail: "contact@delagraineaujardin.com",
  tagline: "Au rythme de la nature",
};

export interface RappelInput {
  clientName: string;
  dateLabel: string; // ex. "mercredi 13 novembre 2026"
  timeLabel?: string | null; // ex. "9 h 00", optionnel
  confirmUrl: string;
}

export interface RappelMail {
  subject: string;
  text: string;
  html: string;
}

const hex = (c: readonly number[]) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
  );

export function buildRappelMail(input: RappelInput): RappelMail {
  const when = input.timeLabel ? `${input.dateLabel} à ${input.timeLabel}` : input.dateLabel;
  const subject = `Rappel : votre intervention du ${input.dateLabel}`;
  const greeting = `Bonjour ${input.clientName},`;
  const intro = `Nous vous rappelons votre intervention prévue le ${when}.`;
  const ask = "Merci de bien vouloir en prendre connaissance et de confirmer d'un simple clic :";
  const cta = "Je confirme avoir pris connaissance de l'intervention";
  const footerNote =
    "Si vous ne pouvez pas être présent ou si vous avez une question, répondez simplement à ce mail.";
  const contact = [RAPPEL_CONFIG.replyEmail, RAPPEL_CONFIG.phone].filter(Boolean).join(" · ");

  const text = [
    greeting,
    "",
    intro,
    ask,
    cta,
    `${input.confirmUrl}`,
    "",
    footerNote,
    "",
    "Cordialement,",
    RAPPEL_CONFIG.signature,
    contact,
  ].join("\n");

  const green = hex(PDF_BRAND.green);
  const orange = hex(PDF_BRAND.orange);
  const dark = hex(PDF_BRAND.dark);
  const muted = hex(PDF_BRAND.muted);
  const line = hex(PDF_BRAND.line);

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f7f9f3;font-family:Georgia,'Times New Roman',serif;color:${dark}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9f3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${line};border-radius:12px">
<tr><td style="padding:24px 28px 8px">
  <div style="font-size:22px;font-weight:bold;color:${green}">${escapeHtml(RAPPEL_CONFIG.companyName)}</div>
  <div style="font-size:12px;color:${muted};font-style:italic">${escapeHtml(RAPPEL_CONFIG.tagline)}</div>
  <div style="height:3px;width:56px;background:${orange};margin-top:12px;border-radius:2px"></div>
</td></tr>
<tr><td style="padding:16px 28px 8px;font-size:15px;line-height:1.6">
  <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
  <p style="margin:0 0 12px">${escapeHtml(intro)}</p>
  <p style="margin:0 0 20px">${escapeHtml(ask)}</p>
  <p style="margin:0 0 24px;text-align:center">
    <a href="${escapeHtml(input.confirmUrl)}" style="display:inline-block;background:${green};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold">${escapeHtml(cta)}</a>
  </p>
  <p style="margin:0 0 16px;font-size:13px;color:${muted}">${escapeHtml(footerNote)}</p>
  <p style="margin:0">Cordialement,<br>${escapeHtml(RAPPEL_CONFIG.signature)}</p>
</td></tr>
<tr><td style="padding:14px 28px 22px;font-size:12px;color:${muted};border-top:1px solid ${line}">${escapeHtml(contact)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}
