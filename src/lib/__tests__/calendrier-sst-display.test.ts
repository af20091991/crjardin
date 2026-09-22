import { describe, expect, it } from "bun:test";
import {
  DEFAULT_CALENDAR_PREFERENCES,
  cornerClass,
  gapClass,
  heightClass,
  mergePreferences,
  styleClass,
  toneClasses,
} from "@/lib/calendrier-sst-display";
import { isoWeekNumber } from "@/lib/calendrier-sst";

describe("calendrier SST — préférences d'affichage", () => {
  it("complète les préférences partielles avec les valeurs par défaut", () => {
    const merged = mergePreferences({ tone: "accent", showWeekNumbers: true });
    expect(merged.tone).toBe("accent");
    expect(merged.showWeekNumbers).toBe(true);
    expect(merged.style).toBe(DEFAULT_CALENDAR_PREFERENCES.style);
    expect(merged.entriesPerDay).toBe(DEFAULT_CALENDAR_PREFERENCES.entriesPerDay);
  });

  it("retombe sur les valeurs par défaut pour une entrée invalide", () => {
    expect(mergePreferences(null)).toEqual(DEFAULT_CALENDAR_PREFERENCES);
    expect(mergePreferences("cassé")).toEqual(DEFAULT_CALENDAR_PREFERENCES);
  });

  it("n'utilise que des tokens sémantiques pour les couleurs", () => {
    const classes = Object.values(toneClasses("accent")).join(" ");
    expect(/#|white|black/.test(classes)).toBe(false);
    expect(classes).toContain("accent");
  });

  it("produit une classe distincte par réglage", () => {
    expect(styleClass("editorial")).not.toBe(styleClass("soft"));
    expect(heightClass("spacious")).not.toBe(heightClass("compact"));
    expect(cornerClass("square")).toBe("rounded-none");
    expect(gapClass("wide")).not.toBe(gapClass("tight"));
  });

  it("calcule le numéro de semaine ISO", () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeekNumber(new Date(2026, 8, 21))).toBe(39);
  });
});
