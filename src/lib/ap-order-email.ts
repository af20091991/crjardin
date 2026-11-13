// Assistant AP — gabarit du mail de commande envoyé au fournisseur.
// Fonction pure (aucun appel réseau, aucun import serveur) : utilisable côté serveur et dans les tests.
export const AP_ORDER_SUBJECT = "Commande De la graine au jardin";
export const AP_ORDER_SENDER_NAME = "Anthony Fournier";
export const AP_ORDER_SITE_NAME = "De la graine au jardin";
export const AP_ORDER_FOOTER = "Envoyé via PilotPro";

const ACCENT = "#2f6b3a";
const TEXT = "#222222";
const MUTED = "#6b6b6b";

export interface ApOrderEmailContent {
  pdfUrl: string;
  ackUrl: string;
}

export interface ApOrderEmailBody {
  subject: string;
  text: string;
  html: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="background:${ACCENT};border-radius:6px"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px">${esc(label)}</a></td></tr></table>`;
}

export function buildApOrderEmail(content: ApOrderEmailContent): ApOrderEmailBody {
  const pdfLabel = "Ouvrir la commande (PDF)";
  const ackLabel = "Accuser réception de la commande";

  const text = [
    "Bonjour,",
    "",
    "Veuillez trouver ci-joint la commande dans le fichier PDF en PJ de ce mail.",
    `${pdfLabel} : ${content.pdfUrl}`,
    "",
    "Je vous remercie par avance de bien vouloir m'accuser réception de cette commande en cliquant sur le lien ci-dessous ou en cliquant sur l'accusé de réception de ce mail.",
    `${ackLabel} : ${content.ackUrl}`,
    "",
    "Si des produits venaient à manquer, je vous remercie de bien vouloir me proposer des substituts afin que la commande soit complète.",
    "",
    "Vous remerciant par avance,",
    "",
    "Bien cordialement,",
    AP_ORDER_SENDER_NAME,
    AP_ORDER_SITE_NAME,
    "",
    "--",
    AP_ORDER_FOOTER,
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(AP_ORDER_SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border-top:4px solid ${ACCENT}">
<tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${TEXT}">
<p style="margin:0 0 16px">Bonjour,</p>
<p style="margin:0 0 4px">Veuillez trouver ci-joint la commande dans le fichier PDF en PJ de ce mail.</p>
${button(content.pdfUrl, pdfLabel)}
<p style="margin:0 0 4px">Je vous remercie par avance de bien vouloir m'accuser réception de cette commande en cliquant sur le bouton ci-dessous ou en cliquant sur l'accusé de réception de ce mail.</p>
${button(content.ackUrl, ackLabel)}
<p style="margin:0 0 16px">Si des produits venaient à manquer, je vous remercie de bien vouloir me proposer des substituts afin que la commande soit complète.</p>
<p style="margin:0 0 16px">Vous remerciant par avance,</p>
<p style="margin:0">Bien cordialement,<br><strong>${esc(AP_ORDER_SENDER_NAME)}</strong><br>${esc(AP_ORDER_SITE_NAME)}</p>
</td></tr>
<tr><td style="padding:14px 32px;border-top:1px solid #e6e6e6;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED}">${esc(AP_ORDER_FOOTER)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: AP_ORDER_SUBJECT, text, html };
}
