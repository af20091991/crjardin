import { describe, expect, test } from "bun:test";
import { buildApOrderEmail, AP_ORDER_SUBJECT } from "@/lib/ap-order-email";

const content = {
  pdfUrl: "https://storage.example/ap-orders/commande.pdf?token=abc",
  ackUrl: "https://crjardin.lovable.app/api/public/ap-order-ack?t=1f2e3d4c-0000-4000-8000-000000000000",
};

describe("buildApOrderEmail", () => {
  test("utilise l'objet demandé, sans nom de signature dans le corps", () => {
    const mail = buildApOrderEmail(content);
    expect(mail.subject).toBe(AP_ORDER_SUBJECT);
    expect(mail.text).not.toContain("Anthony Fournier");
    expect(mail.text).toContain("Envoyé via PilotPro");
  });

  test("le texte contient le lien PDF et le lien d'accusé de réception", () => {
    const mail = buildApOrderEmail(content);
    expect(mail.text).toContain(content.pdfUrl);
    expect(mail.text).toContain(content.ackUrl);
    expect(mail.text).toContain("substituts");
  });

  test("le HTML met en évidence les deux liens sous forme de boutons", () => {
    const mail = buildApOrderEmail(content);
    expect(mail.html).toContain(`href="${content.pdfUrl}"`);
    expect(mail.html).toContain(`href="${content.ackUrl.replace(/&/g, "&amp;")}"`);
    expect(mail.html).toContain("background:#2f6b3a");
    expect(mail.html).not.toContain("<pre");
  });

  test("échappe les valeurs insérées dans le HTML", () => {
    const mail = buildApOrderEmail({ pdfUrl: 'https://x.test/a"<b>', ackUrl: "https://x.test/ack" });
    expect(mail.html).toContain("https://x.test/a&quot;&lt;b&gt;");
    expect(mail.html).not.toContain('a"<b>');
  });
});
