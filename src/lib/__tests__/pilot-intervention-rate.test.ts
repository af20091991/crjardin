import { describe, expect, it } from "bun:test";
import {
  countSaleInterventions,
  countSaleInterventionsWhere,
  isSaleLine,
} from "@/lib/pilot-intervention-count";
import {
  gestionHoursForMonth,
  gestionHoursForYear,
  rateWithGestion,
} from "@/lib/pilot-gestion-hours";

const sales = [
  { id: "1", kind: "vente", entry_date: "2026-01-15", hours: 4 },
  { id: "2", kind: "vente", entry_date: "2026-01-20", hours: 0 }, // 0 h = intervention
  { id: "3", kind: "vente", entry_date: "2026-08-02", hours: 6 },
  { id: "4", kind: "charge", entry_date: "2026-08-02" },
  { id: "5", kind: "vente", entry_date: "2025-08-02", hours: 3 },
];

describe("nombre d'interventions = lignes de vente", () => {
  it("compte 1 intervention par ligne de vente de l'exercice, 0 h inclus", () => {
    expect(countSaleInterventions(sales, { year: 2026 })).toBe(3);
  });

  it("compte par mois", () => {
    expect(countSaleInterventions(sales, { year: 2026, month: 1 })).toBe(2);
    expect(countSaleInterventions(sales, { year: 2026, month: 8 })).toBe(1);
  });

  it("ignore les charges et ne compte jamais deux fois la même ligne", () => {
    expect(isSaleLine({ kind: "charge" })).toBe(false);
    expect(countSaleInterventions([...sales, sales[0]], { year: 2026 })).toBe(3);
  });

  it("compte à date équivalente pour les comparatifs N vs N-1", () => {
    const n = countSaleInterventionsWhere(sales, (d) => d.getFullYear() === 2026);
    const n1 = countSaleInterventionsWhere(sales, (d) => d.getFullYear() === 2025);
    expect(n).toBe(3);
    expect(n1).toBe(1);
  });
});

describe("taux horaire — gestion incluse / exclue", () => {
  const rows = [
    { month: 1, temps_gestion: 10 },
    { month: 8, temps_gestion: null },
  ];

  it("utilise la saisie du suivi mensuel, sinon la valeur par défaut", () => {
    expect(gestionHoursForMonth(rows, 1, 60)).toBe(10);
    expect(gestionHoursForMonth(rows, 8, 60)).toBe(60);
    expect(gestionHoursForYear(rows, 60, 2)).toBe(70);
    expect(gestionHoursForYear(rows, 60, 12)).toBe(10 + 11 * 60);
  });

  it("gestion exclue : CA / heures d'intervention", () => {
    expect(rateWithGestion(1000, 20, 30, false)).toBe(50);
  });

  it("gestion incluse : CA / (heures d'intervention + gestion)", () => {
    expect(rateWithGestion(1000, 20, 30, true)).toBe(20);
  });

  it("ne fabrique aucune valeur sans dénominateur ni CA", () => {
    expect(rateWithGestion(1000, 0, 0, true)).toBeNull();
    expect(rateWithGestion(0, 10, 5, false)).toBeNull();
  });
});
