import { describe, expect, test } from "bun:test";
import {
  computePremiumAlerts,
  detailsToLines,
  linesToDetails,
  type PremiumHealthInput,
} from "@/lib/premium-admin-health";

const NOW = new Date(2026, 9, 2);
const complete: PremiumHealthInput = {
  calendar: [{ year: 2026, month: 11 }],
  coverPhotoId: "p1",
  gardenProfile: "Jardin fleuri",
  lastReportSentAt: new Date(2026, 8, 20).toISOString(),
};

describe("alertes des fiches Premium", () => {
  test("fiche complète : aucune alerte", () => {
    expect(computePremiumAlerts(complete, NOW)).toEqual([]);
  });

  test("signale calendrier, couverture, profil et CR manquants", () => {
    const codes = computePremiumAlerts(
      {
        calendar: [],
        coverPhotoId: null,
        gardenProfile: " ",
        lastReportSentAt: null,
      },
      NOW,
    ).map((alert) => alert.code);
    expect(codes).toEqual(["no_calendar", "no_cover", "no_profile", "no_report"]);
  });

  test("calendrier entièrement passé", () => {
    const alerts = computePremiumAlerts({ ...complete, calendar: [{ year: 2026, month: 3 }] }, NOW);
    expect(alerts.map((alert) => alert.code)).toEqual(["calendar_over"]);
  });

  test("CR trop ancien", () => {
    const alerts = computePremiumAlerts(
      { ...complete, lastReportSentAt: new Date(2026, 4, 1).toISOString() },
      NOW,
    );
    expect(alerts[0].code).toBe("no_report");
    expect(alerts[0].level).toBe("info");
  });
});

describe("édition des détails de travaux", () => {
  test("aller-retour lignes / détails", () => {
    expect(linesToDetails("Taille\n\n Tonte ")).toBe("Taille · Tonte");
    expect(detailsToLines("Taille · Tonte")).toBe("Taille\nTonte");
    expect(linesToDetails("  ")).toBeNull();
  });
});
