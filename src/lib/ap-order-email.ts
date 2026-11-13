// Assistant AP — gabarit du mail de commande envoyé au fournisseur.
// Fonction pure (aucun appel réseau, aucun import serveur) : utilisable côté serveur et dans les tests.
export const AP_ORDER_SUBJECT = "Commande De la graine au jardin";
export const AP_ORDER_SENDER_NAME = "Anthony Fournier";
export const AP_ORDER_SITE_NAME = "De la graine au jardin";
export const AP_ORDER_FOOTER = "Envoyé via PilotPro";

const ACCENT = "#2f6b3a";
const TEXT = "#222222";
const MUTED = "#6b6b6b";

const SIGNATURE_HTML = `<table width="334" height="174" cellspacing="2" cellpadding="2" border="1" style="margin-top:12px"><tbody><tr><td valign="top"><font face="Adobe Garamond Pro" color="#008000"><b><u>EURL De la graine au jardin</u><br></b><i><font size="2">Création de jardin sec et gazon alternatif<br>Entretien de jardin<br>Conseil aux particuliers</font></i><font size="2"><i><br></i></font></font><hr width="100%" size="2"><font face="Adobe Garamond Pro"><b><font color="#008000">tel:</font></b> 07.69.99.03.45<br><b><font color="#008000">@:</font></b>&nbsp;<font color="#008000"> <a href="mailto:stage@delagraineaujardin.com">stage@delagraineaujardin.com</a></font><br><b><font color="#008000">www:</font></b> </font><font face="Adobe Garamond Pro"><font color="#008000"><a href="https://www.delagraineaujardin.com/">De la graine au jardin<br></a><b>Facebook: </b><a href="https://www.facebook.com/delagraineaujardinpaysagiste">De la graine au jardin - Paysagiste</a></font></font></td></tr></tbody></table>`;

const SIGNATURE_TEXT = [
  "EURL De la graine au jardin",
  "Création de jardin sec et gazon alternatif",
  "Entretien de jardin",
  "Conseil aux particuliers",
  "",
  "tel : 07.69.99.03.45",
  "@ : stage@delagraineaujardin.com",
  "www : https://www.delagraineaujardin.com/",
  "Facebook : https://www.facebook.com/delagraineaujardinpaysagiste",
];

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

export function buildApOrderEmail(): ApOrderEmailBody {
  const text = [
    "Bonjour,",
    "",
    "Veuillez trouver ci-joint la commande au format PDF, en pièce jointe de ce mail.",
    "",
    "Je vous remercie par avance de bien vouloir m'accuser réception de cette commande.",
    "",
    "Si des produits venaient à manquer, je vous remercie de bien vouloir me proposer des substituts afin que la commande soit complète.",
    "",
    "Vous remerciant par avance,",
    "",
    "Bien cordialement,",
    "",
    ...SIGNATURE_TEXT,
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
<p style="margin:0 0 16px">Veuillez trouver ci-joint la commande au format PDF, en pièce jointe de ce mail.</p>
<p style="margin:0 0 16px">Je vous remercie par avance de bien vouloir m'accuser réception de cette commande.</p>
<p style="margin:0 0 16px">Si des produits venaient à manquer, je vous remercie de bien vouloir me proposer des substituts afin que la commande soit complète.</p>
<p style="margin:0 0 16px">Vous remerciant par avance,</p>
<p style="margin:0">Bien cordialement,</p>
${SIGNATURE_HTML}
</td></tr>
<tr><td style="padding:14px 32px;border-top:1px solid #e6e6e6;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED}">${esc(AP_ORDER_FOOTER)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: AP_ORDER_SUBJECT, text, html };
}
