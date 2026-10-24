import { describe, expect, test } from "bun:test";
import { buildPageDraft, slugify, MAX_PAGES_PER_MONTH } from "@/lib/visibilite-locale-page";
import { PRESTATIONS_SCORED, TARGET_COMMUNES } from "@/lib/visibilite-locale";

describe("générateur de page locale", () => {
  test("slug propre", () => {
    expect(slugify("Saint-Aunès")).toBe("saint-aunes");
    expect(slugify("Le Crès")).toBe("le-cres");
    expect(MAX_PAGES_PER_MONTH).toBe(4);
  });

  test("toutes les combinaisons respectent les règles du cahier (sauf passage à compléter)", () => {
    for (const prestation of PRESTATIONS_SCORED) {
      for (const commune of TARGET_COMMUNES) {
        const d = buildPageDraft({
          prestation,
          commune: commune.name,
          clientCount: 0,
          topQueries: [],
        });
        const failing = d.checks.filter((c) => !c.ok && c.label !== "Passages à compléter");
        expect(failing).toEqual([]);
        expect(d.title).toContain(commune.name);
        expect(d.placeholders).toBe(1);
        expect(d.slug).toMatch(/^[a-z0-9-]+$/);
        expect(d.faq.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("mention factuelle des clients sans nom ni chiffre précis", () => {
    const none = buildPageDraft({
      prestation: "AP",
      commune: "Castries",
      clientCount: 0,
      topQueries: [],
    });
    const one = buildPageDraft({
      prestation: "AP",
      commune: "Castries",
      clientCount: 1,
      topQueries: [],
    });
    const many = buildPageDraft({
      prestation: "AP",
      commune: "Castries",
      clientCount: 7,
      topQueries: [],
    });
    expect(none.html).not.toContain("accompagnons déjà");
    expect(one.html).toContain("un jardin à Castries");
    expect(many.html).toContain("plusieurs jardins à Castries");
    expect(many.html).not.toContain("7 jardins");
  });

  test("mot-clé principal : requête réelle sinon mot-clé par défaut", () => {
    const real = buildPageDraft({
      prestation: "AP",
      commune: "Jacou",
      clientCount: 0,
      topQueries: ["paysagiste jacou"],
    });
    const def = buildPageDraft({
      prestation: "AP",
      commune: "Jacou",
      clientCount: 0,
      topQueries: [],
    });
    expect(real.focusKeyword).toBe("paysagiste jacou");
    expect(def.focusKeyword).toBe("création jardin méditerranéen Jacou");
  });

  test("données structurées Service + FAQ valides", () => {
    const d = buildPageDraft({
      prestation: "Conseil",
      commune: "Baillargues",
      clientCount: 2,
      topQueries: [],
    });
    const json = JSON.parse(d.jsonLd);
    expect(json["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual([
      "Service",
      "FAQPage",
    ]);
    expect(json["@graph"][1].mainEntity.length).toBe(d.faq.length);
  });
});
