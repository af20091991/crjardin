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
    { month: 1, temps_gestion: 12 },
    { month: 8, temps_gestion: null },
  ];

  // Test B — mois avec Temps gestion renseigné.
  it("utilise exclusivement la saisie du Suivi mensuel", () => {
    expect(gestionHoursForMonth(rows, 1)).toBe(12);
    expect(rateWithGestion(1200, 8, gestionHoursForMonth(rows, 1), true)).toBe(1200 / (8 + 12));
  });

  // Test A — mois sans Temps gestion : 0 h, jamais 60 h ni un autre défaut.
  it("retourne 0 h sans saisie, sans aucun repli automatique", () => {
    expect(gestionHoursForMonth(rows, 8)).toBe(0);
    expect(gestionHoursForYear(rows, 2)).toBe(12);
    expect(gestionHoursForYear(rows, 12)).toBe(12);
    const ca = 1000;
    const heures = 10;
    expect(rateWithGestion(ca, heures, gestionHoursForMonth(rows, 8), true)).toBe(ca / heures);
    expect(rateWithGestion(ca, heures, gestionHoursForMonth(rows, 8), true)).not.toBe(
      ca / (heures + 60),
    );
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

// Test C — exercice complet : toutes les lignes, indépendamment de la date du jour.
// Test D — une ligne à 0 h compte pour 1 intervention.
describe("comptage annuel des interventions — exercice complet", () => {
  const fullYear = Array.from({ length: 12 }, (_, i) => ({
    id: `l${i + 1}`,
    kind: "vente",
    entry_date: `2026-${String(i + 1).padStart(2, "0")}-10`,
    hours: i === 0 ? 0 : 5,
  }));

  it("compte les 12 mois y compris les mois futurs", () => {
    expect(countSaleInterventions(fullYear, { year: 2026 })).toBe(12);
    expect(countSaleInterventions(fullYear, { year: 2026, month: 12 })).toBe(1);
  });

  it("ne dépend pas de la date actuelle ni d'un sous-ensemble réalisé", () => {
    const passees = fullYear.filter((l) => Number(l.entry_date.slice(5, 7)) <= 8);
    expect(countSaleInterventions(passees, { year: 2026 })).toBe(8);
    expect(countSaleInterventions(fullYear, { year: 2026 })).toBe(12);
  });

  it("compte une ligne de vente à 0 h", () => {
    expect(countSaleInterventions([fullYear[0]], { year: 2026 })).toBe(1);
  });
});

