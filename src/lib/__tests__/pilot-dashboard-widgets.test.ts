import { describe, expect, it } from "bun:test";
import {
  DASHBOARD_WIDGETS,
  extraLabel,
  isEmptyWidgetData,
  makeExtraId,
  parseExtraId,
  widgetById,
  type WidgetContext,
} from "@/lib/pilot-dashboard-widgets";
import type { CaEntry, MonthTotals } from "@/lib/pilot-ca";
import type { ClientStat } from "@/lib/pilot";

const LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const month = (i: number, patch: Partial<MonthTotals> = {}): MonthTotals => ({
  month: i + 1,
  ventesHt: 0,
  ventesTtc: 0,
  chargesHt: 0,
  remuneration: 0,
  benefice: 0,
  hours: 0,
  tauxHoraire: 0,
  ...patch,
});

const emptyCtx = (patch: Partial<WidgetContext> = {}): WidgetContext => ({
  entries: [],
  months: LABELS.map((_, i) => month(i)),
  monthlyCa: LABELS.map(() => ({ current: 0, previous: 0 })),
  clients: [],
  interventionsByMonth: LABELS.map(() => 0),
  currentMonth: 9,
  monthLabels: LABELS,
  year: 2026,
  ...patch,
});

const charge = (m: number, amount: number, cls: string | null, cat: string | null) =>
  ({
    kind: "charge",
    month: m,
    amount_ht: amount,
    charge_class: cls,
    charge_category: cat,
    is_investment: false,
  }) as unknown as CaEntry;

const client = (name: string, ca: number, abc: "A" | "B" | "C"): ClientStat =>
  ({ key: name, name, ca, abc }) as unknown as ClientStat;

describe("dashboard — catalogue de graphiques", () => {
  it("propose au moins 15 graphiques, aux identifiants uniques", () => {
    expect(DASHBOARD_WIDGETS.length).toBeGreaterThanOrEqual(15);
    const ids = DASHBOARD_WIDGETS.map((widget) => widget.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque graphique accepte son type par défaut et se construit sans donnée", () => {
    for (const widget of DASHBOARD_WIDGETS) {
      expect(widget.types.map((type) => type.value)).toContain(widget.defaultType);
      const data = widget.build(emptyCtx());
      expect(data.kind).toBe(widget.kind);
      // Pas de donnée fictive : sans donnée, le graphique est vide.
      expect(isEmptyWidgetData(data)).toBe(true);
    }
  });

  it("CA cumulé : N s'arrête au mois courant, N-1 va jusqu'en décembre", () => {
    const ctx = emptyCtx({
      currentMonth: 1,
      monthlyCa: LABELS.map(() => ({ current: 100, previous: 50 })),
    });
    const data = widgetById("ca-cumule")!.build(ctx);
    if (data.kind !== "series") throw new Error("série attendue");
    expect(data.rows[0]?.["2026"]).toBe(100);
    expect(data.rows[1]?.["2026"]).toBe(200);
    expect(data.rows[2]?.["2026"]).toBeNull();
    expect(data.rows[11]?.["2025"]).toBe(600);
  });

  it("CA par trimestre additionne trois mois", () => {
    const ctx = emptyCtx({
      monthlyCa: LABELS.map((_, i) => ({ current: i + 1, previous: 0 })),
    });
    const data = widgetById("ca-trimestre")!.build(ctx);
    if (data.kind !== "series") throw new Error("série attendue");
    expect(data.rows.map((row) => row["2026"])).toEqual([6, 15, 24, 33]);
  });

  it("poids des charges : vide pour un mois sans CA", () => {
    const ctx = emptyCtx({
      months: LABELS.map((_, i) =>
        i === 2 ? month(i, { ventesHt: 1000, chargesHt: 250 }) : month(i, { chargesHt: 80 }),
      ),
    });
    const data = widgetById("taux-charges")!.build(ctx);
    if (data.kind !== "series") throw new Error("série attendue");
    expect(data.rows[2]?.["Charges / CA"]).toBe(25);
    expect(data.rows[0]?.["Charges / CA"]).toBeNull();
  });

  it("charges fixes et variables : sépare par classification, hors investissements", () => {
    const entries = [
      charge(1, 100, "fixe", null),
      charge(1, 40, "variable", null),
      charge(1, 10, null, null),
      { ...charge(1, 999, "fixe", null), is_investment: true } as CaEntry,
    ];
    const data = widgetById("charges-fixes-variables")!.build(emptyCtx({ entries }));
    if (data.kind !== "series") throw new Error("série attendue");
    expect(data.rows[0]).toMatchObject({ Fixes: 100, Variables: 40, "À classer": 10 });
  });

  it("charges par catégorie : regroupe, classe les charges sans catégorie à part", () => {
    const entries = [charge(1, 50, "fixe", "Assurance"), charge(2, 70, "fixe", null)];
    const data = widgetById("charges-categories")!.build(emptyCtx({ entries }));
    if (data.kind !== "share") throw new Error("répartition attendue");
    expect(data.rows).toEqual([
      { name: "Non classée", value: 70 },
      { name: "Assurance", value: 50 },
    ]);
  });

  it("charges par catégorie : au-delà de 7 lignes, le reste est regroupé en « Autres »", () => {
    const entries = Array.from({ length: 10 }, (_, i) => charge(1, 100 + i, "fixe", `Cat ${i}`));
    const data = widgetById("charges-categories")!.build(emptyCtx({ entries }));
    if (data.kind !== "share") throw new Error("répartition attendue");
    expect(data.rows).toHaveLength(7);
    expect(data.rows.at(-1)?.name).toBe("Autres");
  });

  it("top clients : dix au plus, du plus gros au plus petit, noms longs raccourcis", () => {
    const clients = Array.from({ length: 12 }, (_, i) => client(`Client ${i}`, 1000 - i * 10, "A"));
    clients[0] = client("Un nom de client beaucoup trop long pour l'affichage", 1000, "A");
    const data = widgetById("top-clients")!.build(emptyCtx({ clients }));
    if (data.kind !== "share") throw new Error("répartition attendue");
    expect(data.rows).toHaveLength(10);
    expect(data.rows[0]?.name.endsWith("…")).toBe(true);
    expect(data.rows[0]?.value).toBe(1000);
  });

  it("classes ABC : CA cumulé par classe", () => {
    const clients = [client("a", 500, "A"), client("b", 200, "B"), client("c", 100, "A")];
    const data = widgetById("clients-abc")!.build(emptyCtx({ clients }));
    if (data.kind !== "share") throw new Error("répartition attendue");
    expect(data.rows).toEqual([
      { name: "Classe A", value: 600 },
      { name: "Classe B", value: 200 },
    ]);
  });

  it("identifiants des graphiques ajoutés", () => {
    expect(makeExtraId("ca-cumule", [])).toBe("w:ca-cumule:1");
    expect(makeExtraId("ca-cumule", ["w:ca-cumule:1", "w:ca-cumule:3"])).toBe("w:ca-cumule:2");
    expect(parseExtraId("w:ca-cumule:2")).toEqual({ widgetId: "ca-cumule", n: 2 });
    expect(parseExtraId("vue-annee")).toBeNull();
    expect(parseExtraId("w:ca-cumule:x")).toBeNull();
    expect(extraLabel("w:ca-cumule:1")).toBe("CA cumulé N / N-1");
    expect(extraLabel("w:ca-cumule:2")).toBe("CA cumulé N / N-1 (2)");
    expect(extraLabel("w:inconnu:1") === undefined).toBe(true);
  });
});
