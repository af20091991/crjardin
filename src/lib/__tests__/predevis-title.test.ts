import { describe, expect, test } from "bun:test";
import { quoteTitle, type PdfWord } from "../predevis-quote-parse";

const w = (str: string, y: number, x: number, size: number): PdfWord => ({
  page: 1,
  x,
  x1: x + 10,
  y,
  str,
  bold: false,
  size,
});

describe("quoteTitle", () => {
  test("titre sur plusieurs lignes lu du haut vers le bas, sans les petits textes", () => {
    // Coordonnées PDF : y plus grand = plus haut dans la page.
    const words: PdfWord[] = [
      w("INTÉRIEURE", 782, 60, 20.7),
      w("DEVIS", 802, 60, 20.7),
      w("D'AMÉNAGEMENT", 802, 120, 20.7),
      w("POTERIES", 719, 60, 20.7),
      w("Madame", 678, 60, 15),
      w("RUE", 663, 60, 15),
    ];
    expect(quoteTitle(words)).toBe("DEVIS D'AMÉNAGEMENT INTÉRIEURE POTERIES");
  });

  test("sans texte dimensionné : pas de titre", () => {
    expect(quoteTitle([{ ...w("A", 10, 0, 0), size: undefined }])).toBeNull();
  });
});
