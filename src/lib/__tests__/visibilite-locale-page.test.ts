import { describe, expect, test } from "bun:test";
import { buildPageDraft, slugify, MAX_PAGES_PER_MONTH } from "@/lib/visibilite-locale-page";
import { PRESTATIONS_SCORED, TARGET_COMMUNES } from "@/lib/visibilite-locale";

const shingles = (text: string) => {
  const words = text
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + 5 <= words.length; i += 1) set.add(words.slice(i, i + 5).join(" "));
  return set;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
};
const draft = (prestation: (typeof PRESTATIONS_SCORED)[number], commune: string, extra = {}) =>
  buildPageDraft({ prestation, commune, clientCount: 0, topQueries: [], ...extra });

describe("générateur de page locale", () => {
  test("slug propre", () => {
    expect(slugify("Saint-Aunès")).toBe("saint-aunes");
    expect(slugify("Le Crès")).toBe("le-cres");
    expect(MAX_PAGES_PER_MONTH).toBe(4);
  });

  test("toutes les combinaisons respectent les règles (sauf passage à compléter)", () => {
    for (const prestation of PRESTATIONS_SCORED) {
      for (const commune of TARGET_COMMUNES) {
        const d = draft(prestation, commune.name);
        const failing = d.checks.filter((c) => !c.ok && c.label !== "Passages à compléter");
        expect(failing).toEqual([]);
        expect(d.placeholders).toBe(1);
        expect(/^[a-z0-9-]+$/.test(d.slug)).toBe(true);
        expect(d.faq.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("pages longues et sensiblement différentes d'une commune à l'autre", () => {
    for (const prestation of PRESTATIONS_SCORED) {
      const drafts = TARGET_COMMUNES.map((c) => draft(prestation, c.name));
      let sum = 0;
      let pairs = 0;
      for (let i = 0; i < drafts.length; i += 1) {
        for (let j = i + 1; j < drafts.length; j += 1) {
          const v = jaccard(shingles(drafts[i].html), shingles(drafts[j].html));
          expect(v).toBeLessThan(0.5);
          sum += v;
          pairs += 1;
        }
      }
      expect(sum / pairs).toBeLessThan(0.35);
      const orders = new Set(
        drafts.map((d) =>
          [...d.html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1].length).join("-"),
        ),
      );
      expect(orders.size).toBeGreaterThan(2);
    }
  });

  test("déterministe", () => {
    expect(draft("AP", "Jacou").html).toBe(draft("AP", "Jacou").html);
  });

  test("mention clients sans chiffre ; mot-clé ; JSON-LD", () => {
    const many = draft("AP", "Castries", { clientCount: 7 });
    expect(many.html).toContain("plusieurs jardins à Castries");
    expect(many.html).not.toContain("7 jardins");
    expect(draft("AP", "Jacou", { topQueries: ["paysagiste jacou"] }).focusKeyword).toBe(
      "paysagiste jacou",
    );
    expect(draft("AP", "Jacou").focusKeyword).toBe("création jardin méditerranéen Jacou");
    const json = JSON.parse(many.jsonLd);
    expect(json["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual([
      "Service",
      "FAQPage",
    ]);
    expect(json["@graph"][1].mainEntity.length).toBe(many.faq.length);
  });

  test("particularité fournie remplace le passage à compléter", () => {
    const d = draft("AP", "Jacou", { particularity: "Beaucoup de jardins en terrasses." });
    expect(d.placeholders).toBe(0);
    expect(d.html).toContain("Beaucoup de jardins en terrasses.");
  });
});
