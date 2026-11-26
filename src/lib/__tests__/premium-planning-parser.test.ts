import { describe, expect, test } from "bun:test";
import { planningFromPdfItems, type PdfTextItem } from "@/lib/file-parser";

const item = (str: string, x: number, y: number): PdfTextItem => ({ str, x, y });

describe("calendrier PDF CEEV → lignes d'intervention", () => {
  const items = [
    item("Mois", 60, 100),
    item("Type", 160, 100),
    item("Travaux", 280, 100),
    item("Remarques", 450, 100),
    item("Mars", 60, 130),
    item("Taille", 160, 130),
    item("Taille des rosiers", 280, 130),
    item("Tonte", 280, 142),
    item("Juin 2", 60, 190),
    item("Rotofil", 160, 190),
    item("Désherbage des massifs", 280, 190),
    item("Total entretien annuel", 60, 260),
  ];

  test("reprend les mois, types et travaux dans l'ordre du document", () => {
    const rows = planningFromPdfItems(items, 2026);
    expect(rows.map((r) => r.month)).toEqual([3, 6]);
    expect(rows[0].tasks.join(" ")).toContain("Taille des rosiers");
    expect(rows[1].label).toBe("Juin 2");
    expect(rows[1].year).toBe(2026);
  });

  test("ignore les totaux et conditions en fin de document", () => {
    const rows = planningFromPdfItems(items, 2026);
    expect(rows.flatMap((r) => r.tasks).join(" ")).not.toContain("Total");
  });
});
