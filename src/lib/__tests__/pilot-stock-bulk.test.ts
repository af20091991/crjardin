import { describe, expect, it } from "bun:test";
import { parseStockBulkPaste } from "@/lib/pilot-stock";

describe("Stock — parsing de l'ajout en masse", () => {
  it("parse des lignes complètes séparées par tabulation (collage Excel)", () => {
    const text =
      "Oya XL\tObjets\tpièce\t12,50\t4\toui\nGant jardinage\tConsommables\tpaire\t3\t10\tnon";
    const { rows, errors } = parseStockBulkPaste(text);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        name: "Oya XL",
        category: "Objets",
        unit: "pièce",
        unit_price_ht: 12.5,
        is_perishable: true,
        initialQuantity: 4,
      },
      {
        name: "Gant jardinage",
        category: "Consommables",
        unit: "paire",
        unit_price_ht: 3,
        is_perishable: false,
        initialQuantity: 10,
      },
    ]);
  });

  it("parse un CSV séparé par point-virgule", () => {
    const { rows, errors } = parseStockBulkPaste("Terreau;Substrats;sac;8,9;20;non");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        name: "Terreau",
        category: "Substrats",
        unit: "sac",
        unit_price_ht: 8.9,
        is_perishable: false,
        initialQuantity: 20,
      },
    ]);
  });

  it("applique les valeurs par défaut quand les colonnes optionnelles manquent", () => {
    const { rows, errors } = parseStockBulkPaste("Sécateur");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        name: "Sécateur",
        category: "Non catégorisé",
        unit: null,
        unit_price_ht: 0,
        is_perishable: false,
        initialQuantity: 0,
      },
    ]);
  });

  it("ignore les lignes vides et signale les lignes invalides sans bloquer les autres", () => {
    const text = "\n;Objets;;5\n\nSécateur\tOutils\tpièce\tabc\nRâteau\tOutils\tpièce\t7\t3\toui";
    const { rows, errors } = parseStockBulkPaste(text);
    expect(rows).toEqual([
      {
        name: "Râteau",
        category: "Outils",
        unit: "pièce",
        unit_price_ht: 7,
        is_perishable: true,
        initialQuantity: 3,
      },
    ]);
    expect(errors).toEqual([
      "Ligne 1 : nom d'article manquant, ignorée.",
      "Ligne 2 (Sécateur) : prix unitaire invalide, ignorée.",
    ]);
  });
});
