import { describe, expect, test } from "bun:test";
import { buildApOrderEmail, AP_ORDER_SUBJECT } from "@/lib/ap-order-email";

const pdfUrl = "https://storage.example/ap-orders/commande.pdf?token=abc";

describe("buildApOrderEmail", () => {
  test("utilise l'objet demandé et contient le lien PDF", () => {
    const mail = buildApOrderEmail({ pdfUrl });
    expect(mail.subject).toBe(AP_ORDER_SUBJECT);
    expect(mail.text).toContain(pdfUrl);
    expect(mail.html).toContain(`href="${pdfUrl}"`);
    expect(mail.text).toContain("Envoyé via PilotPro");
  });
});
