import { describe, expect, test } from "bun:test";
import { detectThemes } from "../predevis-themes";

describe("detectThemes", () => {
  test("le titre donne le thème principal", () => {
    expect(detectThemes("Terrassement et préparation", []).main).toBe("Travaux préparatoires");
    expect(detectThemes("Gazon alternatif, 2 espèces", []).main).toBe("Gazon alternatif");
  });
  test("le broyat reste en travaux préparatoires même si le titre cite le massif", () => {
    expect(detectThemes("Broyat sur massif de fond de jardin", []).main).toBe(
      "Travaux préparatoires",
    );
  });
  test("les désignations donnent les thèmes secondaires", () => {
    const d = detectThemes("Aménagement des massifs proche figuier", [
      "Arbuste de haie - C3/C7 - H2",
      "Arbre 10/12 - A3",
      "Vivace 1,4L A-C AEF",
    ]);
    expect(d.main).toBe("Plantation de massif");
    expect(d.secondary).toEqual(["Plantation de haie", "Plantation d'arbre"]);
  });
  test("aucun mot-clé, aucun thème", () => {
    expect(detectThemes("Divers", ["Forfait"])).toEqual({ main: null, secondary: [] });
  });
});
