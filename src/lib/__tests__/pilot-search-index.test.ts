import { describe, expect, it } from "bun:test";
import { searchIndex, type SearchResult } from "@/lib/pilot-search";

const index: SearchResult[] = [
  {
    id: "cr-1",
    kind: "cr",
    label: "Sirmai · CR 2026-10-02",
    to: "/interventions/$interventionId",
    haystack: "Sirmai taille des haies, remplacer le tuyau d'arrosage",
  },
  {
    id: "mat-1",
    kind: "materiel",
    label: "Tondeuse",
    to: "/parc-materiel/$equipmentId",
    haystack: "Tondeuse Honda, lame à changer",
  },
];

describe("recherche globale", () => {
  it("trouve un mot présent dans le texte d'un compte-rendu", () => {
    const found = searchIndex(index, "arrosage");
    expect(found.map((r) => r.id)).toEqual(["cr-1"]);
  });

  it("ignore les accents et la casse", () => {
    expect(searchIndex(index, "LAME").map((r) => r.id)).toEqual(["mat-1"]);
  });

  it("ne renvoie rien pour un mot absent", () => {
    expect(searchIndex(index, "piscine")).toEqual([]);
  });
});
