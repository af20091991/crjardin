import { describe, expect, test } from "bun:test";
import {
  buildControlQueue,
  canAutoApply,
  filterControlActions,
  impactBucket,
  type OrphanInput,
} from "@/lib/pilot-control-queue";

const orphan = (over: Partial<OrphanInput> = {}): OrphanInput => ({
  id: "e1",
  label: "SARL Bodard",
  amount: 5000,
  year: 2026,
  best: {
    clientId: "c1",
    clientName: "SARL Bodard",
    confidence: "haute",
    reason: "exact",
    score: 1,
  },
  others: [],
  ...over,
});

const base = {
  integrity: null,
  reconciliation: null,
  anomalies: null,
  kpi: null,
  orphans: null,
  charges: null,
  salesMissingTime: null,
  sstMissingClient: null,
};

describe("file d'actions du Centre de contrôle", () => {
  test("classe une correspondance exacte et haute confiance en correction automatique", () => {
    const q = buildControlQueue({ ...base, orphans: [orphan()] });
    expect(q.actions[0].level).toBe("auto");
    expect(q.summary.autoCount).toBe(1);
    expect(canAutoApply(q.actions[0])).toBe(true);
  });

  test("refuse l'automatisme dès qu'un autre client est possible", () => {
    const q = buildControlQueue({ ...base, orphans: [orphan({ others: ["Bodard Père et Fils"] })] });
    expect(q.actions[0].level).toBe("suggestion");
    expect(canAutoApply(q.actions[0])).toBe(false);
    expect(q.actions[0].whyNotAuto.length).toBeGreaterThan(0);
  });

  test("passe une ressemblance simple en suggestion, et une absence en action manuelle", () => {
    const sugg = buildControlQueue({
      ...base,
      orphans: [orphan({ best: { clientId: "c1", clientName: "Bodar", confidence: "moyenne", reason: "similarite", score: 0.8 } })],
    });
    expect(sugg.actions[0].level).toBe("suggestion");
    const none = buildControlQueue({ ...base, orphans: [orphan({ best: null })] });
    expect(none.actions[0].level).toBe("manuel");
    expect(none.actions[0].operation.kind).toBe("none");
  });

  test("ne classe jamais une charge automatiquement (le bénéfice est impacté)", () => {
    const q = buildControlQueue({
      ...base,
      charges: [
        { id: "ch1", label: "Assurance MAAF", amount: 900, year: 2026, suggestion: { target: "fixe", category: "Assurances", why: "mot-clé" } },
      ],
    });
    expect(q.actions[0].level).toBe("suggestion");
    expect(q.summary.autoCount).toBe(0);
  });

  test("distingue une erreur de lecture d'une absence de donnée", () => {
    const q = buildControlQueue({
      ...base,
      loadErrors: [{ key: "clients", label: "Référentiel clients", message: "timeout" }],
    });
    expect(q.actions.length).toBe(1);
    expect(q.actions[0].level).toBe("info");
    expect(q.actions[0].state).toBe("indisponible");
    expect(q.summary.unavailableSources).toBe(1);
  });

  test("priorise les montants élevés puis les blocages de KPI", () => {
    const q = buildControlQueue({
      ...base,
      orphans: [
        orphan({ id: "small", amount: 100, best: null }),
        orphan({ id: "big", amount: 12000, best: null }),
      ],
    });
    expect(q.actions[0].key).toContain("big");
  });

  test("sort de la file active une anomalie ayant un état final, sans la perdre", () => {
    const q = buildControlQueue({
      ...base,
      orphans: [orphan()],
      states: { "ca_orphan:e1": "justifiee" },
    });
    expect(q.actions.length).toBe(0);
    expect(q.closed[0].state).toBe("justifiee");
    expect(q.summary.handled).toBe(1);
  });

  test("filtre par domaine, niveau et impact", () => {
    const q = buildControlQueue({
      ...base,
      orphans: [orphan()],
      charges: [{ id: "ch1", label: "EDF", amount: 50, year: 2026, suggestion: null }],
    });
    expect(filterControlActions(q.actions, { domain: "charges" }).length).toBe(1);
    expect(filterControlActions(q.actions, { level: "auto" }).length).toBe(1);
    expect(filterControlActions(q.actions, { impact: "eleve" }).length).toBe(1);
    expect(impactBucket(null)).toBe("aucun");
  });
});
