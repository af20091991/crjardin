import { describe, expect, test } from "bun:test";
import { boldFonts } from "../predevis-font";

describe("boldFonts", () => {
  test("nom de police lisible : il fait foi", () => {
    const s = [
      { fontName: "F1", family: "NunitoBold", em: 1, chars: 10 },
      { fontName: "F2", family: "NunitoRegular", em: 1, chars: 10 },
    ];
    expect([...boldFonts(s)]).toEqual(["F1"]);
  });

  test("noms illisibles : la police la plus large par caractère est la grasse", () => {
    // Valeurs mesurées sur le devis réel : 0,370 em/caractère contre 0,341
    const s = [
      { fontName: "g_d0_f1", family: "sans-serif", em: 0.37 * 790, chars: 790 },
      { fontName: "g_d0_f2", family: "sans-serif", em: 0.3407 * 6600, chars: 6600 },
    ];
    expect([...boldFonts(s)]).toEqual(["g_d0_f1"]);
  });

  test("une seule police ou écart trop faible : aucun gras déduit", () => {
    expect(boldFonts([{ fontName: "A", family: "x", em: 1, chars: 10 }]).size).toBe(0);
    expect(
      boldFonts([
        { fontName: "A", family: "x", em: 1, chars: 10 },
        { fontName: "B", family: "x", em: 1.01, chars: 10 },
      ]).size,
    ).toBe(0);
  });
});
