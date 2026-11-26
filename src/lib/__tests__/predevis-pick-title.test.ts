import { describe, expect, test } from "bun:test";
import { pickTitle } from "../predevis-quote-parse";

describe("intitulé de poste", () => {
  test("une phrase d'introduction en gras n'est jamais un intitulé", () => {
    expect(
      pickTitle([
        [
          "Ce devis correspond à l'aménagement des espaces et entités suivantes: Z1 et Z3 (voir plan en annexe)",
        ],
      ]),
    ).toBeNull();
  });

  test("un intitulé avec « : » prime sur un autre bloc en gras", () => {
    expect(pickTitle([["Travaux préparatoires:"], ["les devis"]])).toBe("Travaux préparatoires:");
  });

  test("sans « : », le premier bloc court en gras est retenu, le bloc se coupe à la ligne suivante", () => {
    expect(
      pickTitle([["Mise en place d'un goutte à goutte", "avec programmateur Bluetooth"]]),
    ).toBe("Mise en place d'un goutte à goutte avec programmateur Bluetooth");
  });
});
