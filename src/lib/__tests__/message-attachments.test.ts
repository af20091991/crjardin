import { describe, expect, test } from "bun:test";
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  chatAttachmentPath,
  formatBytes,
  mergeSelection,
  resolveChatMime,
  safeStorageName,
  validateChatAttachment,
} from "@/lib/message-attachments";

describe("pièces jointes du chat", () => {
  test("accepte images, PDF et documents bureautiques", () => {
    expect(validateChatAttachment({ name: "a.jpg", size: 100, type: "image/jpeg" })).toBeNull();
    expect(
      validateChatAttachment({ name: "devis.pdf", size: 100, type: "application/pdf" }),
    ).toBeNull();
    expect(validateChatAttachment({ name: "plan.docx", size: 100, type: "" })).toBeNull();
  });

  test("refuse les types non autorisés, les fichiers vides et trop lourds", () => {
    expect(
      validateChatAttachment({ name: "x.exe", size: 100, type: "application/x-msdownload" }),
    ).toContain("non autorisé");
    expect(validateChatAttachment({ name: "x.svg", size: 100, type: "image/svg+xml" })).toContain(
      "non autorisé",
    );
    expect(validateChatAttachment({ name: "x.pdf", size: 0, type: "application/pdf" })).toContain(
      "vide",
    );
    expect(
      validateChatAttachment({
        name: "x.pdf",
        size: CHAT_ATTACHMENT_MAX_BYTES + 1,
        type: "application/pdf",
      }),
    ).toContain("10 Mo");
  });

  test("déduit le type HEIC depuis l'extension quand le navigateur ne le donne pas", () => {
    expect(resolveChatMime("IMG_1.HEIC", "")).toBe("image/heic");
  });

  test("chemin déterministe sous le dossier du client, sans traversée", () => {
    const p = chatAttachmentPath("c1", "r1", 0, "../../Été photo.jpg");
    expect(p.startsWith("c1/r1/0-")).toBe(true);
    expect(p).not.toContain("..");
    expect(chatAttachmentPath("c1", "r1", 0, "a.jpg")).toBe(
      chatAttachmentPath("c1", "r1", 0, "a.jpg"),
    );
    expect(safeStorageName("")).toBe("fichier");
  });

  test("sélection limitée à 5 fichiers, sans doublon", () => {
    const f = (n: string) => ({ name: n, size: 1 });
    const { files, rejected } = mergeSelection(
      [f("a")],
      [f("a"), f("b"), f("c"), f("d"), f("e"), f("g")],
    );
    expect(files.map((x) => x.name)).toEqual(["a", "b", "c", "d", "e"]);
    expect(rejected).toBe(1);
  });

  test("taille lisible", () => {
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(1572864)).toBe("1,5 Mo");
  });
});
