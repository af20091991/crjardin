import { describe, expect, test } from "bun:test";
import { annualSummary } from "@/lib/pilot-annual";
import { pragmaticHealth } from "@/lib/pilot-health";
import { charge, sale, YEAR } from "./pilot-fixtures";
import type { Kpis, PilotSettings } from "@/lib/pilot";

/**
 * Le score Santé lit le réalisé « à date » : aucune vente ni charge
 * postérieure au jour de consultation ne doit entrer dans le score financier.
 */
const NOW = new Date(`${YEAR}-08-15T12:00:00Z`);

const entries = [
  sale({ id: "passe", entry_date: `${YEAR}-03-10`, amount_ht: 10_000, hours: 100 }),
  sale({ id: "futur", entry_date: `${YEAR}-11-20`, amount_ht: 50_000, hours: 100 }),
];
const charges = [
  charge({ id: "c-passe", year: YEAR, month: 3, amount_ht: 4_000 }),
  charge({ id: "c-futur", year: YEAR, month: 11, amount_ht: 30_000 }),
];

const settings = { target_hourly_rate: 45 } as unknown as PilotSettings;
const kpis = { caPrevYTD: 0, progression: 0, panierMoyen: 0, tauxHoraireReel: 0, tauxHoraireVendu: 0, nbEntries: 0 } as unknown as Kpis;

describe("Santé — périmètre temporel du score financier", () => {
  test("mode à date : le CA et les charges futurs sont exclus", () => {
    const [row] = annualSummary(entries, charges, { mode: "reel", now: NOW, period: "a_date" });
    expect(row.caHt).toBe(10_000);
    expect(row.charges).toBe(4_000);
    expect(row.margePct).toBeCloseTo(60, 5);
  });

  test("exercice complet : lecture intégrale seulement sur demande explicite", () => {
    const [row] = annualSummary(entries, charges, {
      mode: "reel",
      now: NOW,
      period: "exercice_complet",
    });
    expect(row.caHt).toBe(60_000);
    expect(row.charges).toBe(34_000);
  });

  test("score financier calculé sur le réalisé à date, jamais sur une base de charges vide", () => {
    const [row] = annualSummary(entries, charges, { mode: "reel", now: NOW, period: "a_date" });
    const h = pragmaticHealth({ k: kpis, annual: row, settings, goals: [] });
    const fin = h.themes.find((t) => t.theme === "financiere");
    expect(fin?.score).not.toBeNull();
    expect(fin?.details.find((d) => d.label === "Bénéfice brut")?.value).toContain("6");
  });

  test("aucune donnée exploitable : axe financier « données insuffisantes » plutôt que 0", () => {
    const h = pragmaticHealth({ k: kpis, annual: null, settings, goals: [] });
    expect(h.themes.find((t) => t.theme === "financiere")?.score).toBeNull();
  });
});
