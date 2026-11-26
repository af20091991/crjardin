import { describe, expect, test } from "bun:test";
import { textItemsToWords, type TextItem } from "../predevis-quote-pdf";

const base = { page: 1, y: 100, size: 10, family: "" };

describe("textItemsToWords", () => {
  test("découpe un item multi-mots en mots distincts", () => {
    const items: TextItem[] = [{ ...base, str: "PU Vente", x0: 353, width: 44, fontName: "F2" }];
    const words = textItemsToWords(items);
    expect(words.map((w) => w.str)).toEqual(["PU", "Vente"]);
    expect(words[0]!.x).toBe(353);
    expect(words[1]!.x1).toBe(397);
  });

  test("marque en gras les mots de la police la plus large, ignore les espaces seuls", () => {
    const items: TextItem[] = [
      { ...base, str: " ", x0: 65, width: 88, fontName: "F2" },
      { ...base, str: "Travaux préparatoires:", x0: 18, width: 110, fontName: "F1" },
      { ...base, str: "Quantité", x0: 289, width: 24, fontName: "F2" },
    ];
    const words = textItemsToWords(items);
    const titre = words.filter((w) => w.str === "Travaux" || w.str === "préparatoires:");
    expect(titre.every((w) => w.bold)).toBe(true);
    expect(words.find((w) => w.str === "Quantité")?.bold).toBe(false);
    expect(words.some((w) => w.str.trim() === "")).toBe(false);
  });
});
