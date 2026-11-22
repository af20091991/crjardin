import { describe, expect, test } from "bun:test";
import type { SstRow } from "@/lib/sst-analytics";
import type { SubcontractorMission } from "@/lib/subcontractors";
import {
  hourlyByPrestation,
  hoursBySubcontractor,
  monthlyBySubcontractor,
  monthlyModeMix,
  priceGaps,
  upcomingMissions,
  yearlySummary,
} from "@/lib/sst-dashboard-metrics";

function row(p: {
  id: string;
  date: string;
  sst: string;
  prestation?: string;
  agreed?: number | null;
  invoiced?: number | null;
  hours?: number | null;
  saved?: number | null;
  revenue?: number;
  cost?: number;
  mode?: "autonome" | "accompagnee" | null;
  archived?: string | null;
}): SstRow {
  const mission = {
    id: p.id,
    mission_date: p.date,
    service_requested: "Taille",
    prestation: p.prestation ?? null,
    agreed_price: p.agreed ?? null,
    invoiced_amount: p.invoiced ?? null,
    hours_spent: p.hours ?? null,
    hours_saved: p.saved ?? null,
    sst_mode: p.mode ?? null,
    archived_at: p.archived ?? null,
  } as unknown as SubcontractorMission;
  const revenue = p.revenue ?? 0;
  const cost = p.cost ?? 0;
  return {
    mission,
    sstName: p.sst,
    clientName: "—",
    revenue,
    cost,
    margin: revenue - cost,
    marginPct: null,
    hours: p.hours ?? null,
    hourlyCost: null,
  } as unknown as SstRow;
}

describe("priceGaps", () => {
  test("écart facturé − convenu, missions sans montant ou accompagnées exclues", () => {
    const rows = [
      row({ id: "a", date: "2026-03-01", sst: "Lionel", agreed: 500, invoiced: 600 }),
      row({ id: "b", date: "2026-03-02", sst: "Lionel", agreed: 400, invoiced: 400 }),
      row({ id: "c", date: "2026-03-03", sst: "Marc", agreed: 300, invoiced: 250 }),
      row({ id: "d", date: "2026-03-04", sst: "Marc", agreed: null, invoiced: 250 }),
      row({
        id: "e",
        date: "2026-03-05",
        sst: "Marc",
        agreed: 300,
        invoiced: 350,
        mode: "accompagnee",
      }),
    ];
    const g = priceGaps(rows);
    expect(g.count).toBe(2);
    expect(g.total).toBe(50);
    expect(g.items[0].id).toBe("a");
    expect(g.items[1].gap).toBe(-50);
  });
});

describe("hourlyByPrestation", () => {
  test("prix et coût par heure, heures nulles ignorées", () => {
    const rows = [
      row({
        id: "a",
        date: "2026-03-01",
        sst: "L",
        prestation: "Taille",
        hours: 4,
        revenue: 400,
        cost: 200,
      }),
      row({
        id: "b",
        date: "2026-03-02",
        sst: "L",
        prestation: "Taille",
        hours: 6,
        revenue: 600,
        cost: 300,
      }),
      row({
        id: "c",
        date: "2026-03-03",
        sst: "L",
        prestation: "Taille",
        hours: null,
        revenue: 100,
        cost: 50,
      }),
    ];
    const [taille] = hourlyByPrestation(rows);
    expect(taille.hours).toBe(10);
    expect(taille.saleHourly).toBe(100);
    expect(taille.costHourly).toBe(50);
    expect(taille.marginHourly).toBe(50);
  });
});

describe("hoursBySubcontractor", () => {
  test("heures économisées face aux heures réalisées", () => {
    const rows = [
      row({ id: "a", date: "2026-03-01", sst: "L", hours: 4, saved: 8 }),
      row({ id: "b", date: "2026-03-02", sst: "M", hours: 2, saved: null }),
    ];
    const res = hoursBySubcontractor(rows);
    expect(res[0]).toMatchObject({ name: "L", saved: 8, realized: 4 });
    expect(res[1]).toMatchObject({ name: "M", saved: 2, realized: 2 });
  });
});

describe("monthlyModeMix et monthlyBySubcontractor", () => {
  test("répartition par mois", () => {
    const rows = [
      row({ id: "a", date: "2026-03-01", sst: "L", mode: "autonome" }),
      row({ id: "b", date: "2026-03-02", sst: "L", mode: "accompagnee" }),
      row({ id: "c", date: "2026-04-02", sst: "M", mode: null }),
    ];
    const mix = monthlyModeMix(rows);
    expect(mix[0]).toMatchObject({ key: "2026-03", autonome: 1, chantier: 1, nonClassee: 0 });
    expect(mix[1]).toMatchObject({ key: "2026-04", nonClassee: 1 });
  });

  test("au-delà du top, regroupement en « Autres »", () => {
    const rows = ["A", "B", "C", "D", "E", "F"].flatMap((s, i) =>
      Array.from({ length: 6 - i }, (_, k) => row({ id: `${s}${k}`, date: "2026-03-01", sst: s })),
    );
    const res = monthlyBySubcontractor(rows, 5);
    expect(res.subs).toEqual(["A", "B", "C", "D", "E", "Autres"]);
    expect(res.months[0].counts.Autres).toBe(1);
  });
});

describe("yearlySummary", () => {
  test("années à partir de 2026, coût incluant les charges sans fiche, part du CA", () => {
    const rows = [
      row({ id: "a", date: "2026-03-01", sst: "L", revenue: 1000, cost: 600 }),
      row({ id: "b", date: "2025-03-01", sst: "L", revenue: 900, cost: 500 }),
      row({ id: "c", date: "2027-03-01", sst: "L", revenue: 2000, cost: 1000 }),
    ];
    const years = yearlySummary(rows, [{ year: 2026, amount: 100 }], new Map([[2026, 10000]]));
    expect(years.map((y) => y.year)).toEqual([2026, 2027]);
    expect(years[0]).toMatchObject({
      revenue: 1000,
      cost: 700,
      orphan: 100,
      margin: 400,
      shareOfSales: 10,
    });
    expect(years[1].shareOfSales).toBeNull();
  });
});

describe("upcomingMissions", () => {
  test("missions à venir, non archivées, par date croissante", () => {
    const missions = [
      row({ id: "a", date: "2026-12-05", sst: "L" }).mission,
      row({ id: "b", date: "2026-11-01", sst: "L" }).mission,
      row({ id: "c", date: "2026-12-01", sst: "L", archived: "2026-11-10" }).mission,
    ];
    const res = upcomingMissions(missions, "2026-11-22");
    expect(res.map((m) => m.id)).toEqual(["a"]);
  });
});
