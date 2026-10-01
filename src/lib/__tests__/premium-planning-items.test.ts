import { describe, expect, test } from "bun:test";
import { pickNextIntervention, planningRowsToCalendarItems } from "@/lib/premium-planning-items";

describe("prochaine intervention", () => {
  const items = [
    { id: "a", year: 2026, month: 3 },
    { id: "b", year: 2026, month: 10 },
    { id: "c", year: 2026, month: 10 },
    { id: "d", year: 2026, month: 12 },
  ];

  test("choisit le mois en cours quand il existe", () => {
    expect(pickNextIntervention(items, new Date(2026, 9, 2))?.id).toBe("b");
  });

  test("passe au mois suivant disponible et ignore le passé", () => {
    expect(pickNextIntervention(items, new Date(2026, 10, 5))?.id).toBe("d");
  });

  test("retourne null quand tout est passé", () => {
    expect(pickNextIntervention(items, new Date(2027, 0, 5))).toBeNull();
  });
});

describe("conversion des lignes du PDF", () => {
  test("reprend type, travaux et année sans IA", () => {
    const [item] = planningRowsToCalendarItems([
      {
        index: 0,
        month: 6,
        monthLabel: "Juin",
        label: "Juin 2",
        type: "Rotofil",
        tasks: ["Rotofil des massifs", "Désherbage"],
        year: 2026,
      },
    ]);
    expect(item.title).toBe("Rotofil");
    expect(item.sequence).toBe(2);
    expect(item.period_label).toBe("Juin 2 2026");
    expect(item.details).toBe("Rotofil des massifs · Désherbage");
  });
});
