import { describe, expect, test } from "bun:test";
import { rankClientsByBenefit } from "@/lib/pilot-client-benefit";
import type { ChargeRow } from "@/lib/pilot-charges";
import type { PilotEntry } from "@/lib/pilot";

const sale = (values: Partial<PilotEntry> & Pick<PilotEntry, "id" | "client_id" | "amount_ht">): PilotEntry => ({
  user_id: "u1", entry_date: "2026-09-01", client_name: values.client_id, family: "amenagement",
  nature: "AP", amount_ttc: values.amount_ht * 1.2, hours: 0, hours_raw: 0,
  intervention_type: null, amount_ht_raw: values.amount_ht, hours_input: 0, observation: null,
  created_at: "2026-09-01", updated_at: "2026-09-01", ...values,
});
const charge = (values: Partial<ChargeRow>): ChargeRow => ({
  id: "q1", year: 2026, month: 9, designation: "Fourniture", amount_ht: 100,
  charge_class: "variable", charge_category: "Matériaux", kind: "charge", is_investment: false,
  client_id: null, site_id: null, intervention_id: null, ...values,
});

describe("rankClientsByBenefit", () => {
  test("déduit uniquement les charges explicitement rattachées", () => {
    const rows = rankClientsByBenefit(
      [sale({ id: "s1", client_id: "c1", client_name: "Cluzel", amount_ht: 1000 })],
      [charge({ client_id: "c1", amount_ht: 250 }), charge({ id: "q2", amount_ht: 500 })],
      2026,
      9,
    );
    expect(rows[0]).toMatchObject({ name: "Cluzel", ca: 1000, charges: 250, benefit: 750 });
  });

  test("rattache une charge par chantier ou intervention sans deviner par texte", () => {
    const entries = [
      sale({ id: "s1", client_id: "c1", amount_ht: 900, site_id: "site-1" }),
      sale({ id: "s2", client_id: "c2", amount_ht: 800, intervention_id: "int-2" }),
    ];
    const rows = rankClientsByBenefit(entries, [
      charge({ site_id: "site-1", amount_ht: 100 }),
      charge({ id: "q2", intervention_id: "int-2", amount_ht: 300 }),
    ], 2026, 9);
    expect(rows.map(({ key, benefit }) => ({ key, benefit }))).toEqual([
      { key: "c1", benefit: 800 },
      { key: "c2", benefit: 500 },
    ]);
  });

  test("exclut investissements, rémunérations et autres périodes", () => {
    const entries = [sale({ id: "s1", client_id: "c1", amount_ht: 1000 })];
    const rows = rankClientsByBenefit(entries, [
      charge({ client_id: "c1", is_investment: true, amount_ht: 900 }),
      charge({ id: "q2", client_id: "c1", kind: "remuneration", amount_ht: 800 }),
      charge({ id: "q3", client_id: "c1", month: 8, amount_ht: 700 }),
    ], 2026, 9);
    expect(rows[0].benefit).toBe(1000);
  });
});