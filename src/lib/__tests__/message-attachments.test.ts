import { describe, expect, it } from "bun:test";
import {
  attachmentError,
  attachmentOnlyContent,
  formatFileSize,
  hasAttachment,
} from "@/lib/message-attachments";

describe("pièces jointes de la messagerie Premium", () => {
  it("accepte photos et PDF jusqu'à 10 Mo", () => {
    expect(attachmentError({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(attachmentError({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(attachmentError({ name: "devis.PDF", type: "", size: 1000 })).toBeNull();
  });

  it("refuse les autres types, les fichiers vides et trop lourds", () => {
    expect(attachmentError({ name: "a.docx", type: "application/msword", size: 1000 })).toContain(
      "photo ou un PDF",
    );
    expect(attachmentError({ name: "a.jpg", type: "image/jpeg", size: 0 })).toContain("vide");
    expect(
      attachmentError({ name: "a.jpg", type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }),
    ).toContain("10 Mo");
  });

  it("détecte la présence d'une pièce jointe", () => {
    expect(hasAttachment({ has_attachment: true })).toBe(true);
    expect(hasAttachment({ attachment_path: "c/x.pdf" })).toBe(true);
    expect(hasAttachment({})).toBe(false);
  });

  it("formate la taille et le texte par défaut", () => {
    expect(formatFileSize(2048)).toBe("2 Ko");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3,0 Mo");
    expect(formatFileSize(null)).toBe("");
    expect(attachmentOnlyContent("plan.pdf")).toBe("Pièce jointe : plan.pdf");
  });
});
