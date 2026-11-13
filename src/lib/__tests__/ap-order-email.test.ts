import { describe, expect, test } from "bun:test";
import { buildApOrderEmail, AP_ORDER_SUBJECT } from "@/lib/ap-order-email";

describe("buildApOrderEmail", () => {
  test("utilise l'objet demandé et annonce la commande en pièce jointe PDF", () => {
    const mail = buildApOrderEmail();
    expect(mail.subject).toBe(AP_ORDER_SUBJECT);
    expect(mail.text).toContain("en pièce jointe de ce mail");
    expect(mail.text).toContain("format PDF");
    expect(mail.text).toContain("Envoyé via PilotPro");
  });

  test("ne contient ni lien ni bouton", () => {
    const mail = buildApOrderEmail();
    expect(mail.text).not.toContain("ap-order-ack");
    expect(mail.text).not.toContain("Accuser réception de la commande :");
    expect(mail.html).not.toContain("<a href=\"https://crjardin");
    expect(mail.html).not.toContain("Accuser réception de la commande</a>");
    expect(mail.html).not.toContain("<pre");
  });
});
