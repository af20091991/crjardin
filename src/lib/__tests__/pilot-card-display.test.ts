import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_VALUE_FORMAT,
  compactEuro,
  formatValueText,
  shortLabel,
  signalFromTone,
} from "@/lib/pilot-card-display";
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  effectiveCardStyle,
  effectiveValueAlign,
  CARD_STYLES,
} from "@/lib/appearance";

const REAL_DOCUMENT = (globalThis as any).document;
const REAL_WINDOW = (globalThis as any).window;

// Le DOM factice ne doit jamais survivre au fichier : les tests de rendu réel
// (@testing-library) exécutés ensuite dans le même process ont besoin du vrai DOM.
afterAll(() => {
  (globalThis as any).document = REAL_DOCUMENT;
  (globalThis as any).window = REAL_WINDOW;
});

function setupDom() {
  const attrs = new Map<string, string>();
  const root = {
    classList: { toggle: () => {} },
    style: { setProperty: () => {}, removeProperty: () => {} },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
  };
  (globalThis as any).document = { documentElement: root };
  (globalThis as any).window = { matchMedia: () => ({ matches: false }) };
  return attrs;
}

describe("format d'affichage des valeurs", () => {
  test("par défaut, aucun texte n'est modifié", () => {
    const src = "80 400 € · 533,3 h · 34,2 %";
    expect(formatValueText(src, DEFAULT_VALUE_FORMAT)).toBe(src);
  });

  test("montants compacts", () => {
    expect(compactEuro(80400)).toBe("80,4 k€");
    expect(compactEuro(1250000)).toBe("1,3 M€");
    expect(compactEuro(640)).toBe("640 €");
    expect(
      formatValueText("80 400 €", { ...DEFAULT_VALUE_FORMAT, euro: "compact" }),
    ).toBe("80,4 k€");
  });

  test("heures et pourcentages entiers", () => {
    expect(formatValueText("533,3 h", { ...DEFAULT_VALUE_FORMAT, hours: "integer" })).toBe("533 h");
    expect(formatValueText("34,2 %", { ...DEFAULT_VALUE_FORMAT, percent: "integer" })).toBe("34 %");
    // Un mot commençant par « h » n'est jamais confondu avec une unité d'heures.
    expect(
      formatValueText("12,5 hectares", { ...DEFAULT_VALUE_FORMAT, hours: "integer" }),
    ).toBe("12,5 hectares");
  });

  test("un texte sans valeur reconnue reste intact", () => {
    const opts = { euro: "compact", hours: "integer", percent: "integer" } as const;
    expect(formatValueText("Non renseignées", opts)).toBe("Non renseignées");
  });
});

describe("libellés courts", () => {
  test("raccourci uniquement quand il est défini", () => {
    expect(shortLabel("Chiffre d'affaires réalisé")).toBe("CA réalisé");
    expect(shortLabel("Heures d'intervention")).toBe("Heures");
    expect(shortLabel("CA cumulé 2026")).toBe("CA 2026");
    expect(shortLabel("Missions sous-traitées sans client")).toBe(
      "Missions sous-traitées sans client",
    );
  });
});

describe("voyants", () => {
  test("aucun voyant sans ton interprétatif", () => {
    expect(signalFromTone("default")).toBeNull();
    expect(signalFromTone("positive")).toBe("ok");
    expect(signalFromTone("warning")).toBe("watch");
    expect(signalFromTone("negative")).toBe("low");
  });
});

describe("réglages de lecture des cartes", () => {
  test("valeurs par défaut : aucun attribut posé (rendu actuel conservé)", () => {
    const attrs = setupDom();
    applyAppearance(DEFAULT_APPEARANCE);
    for (const k of [
      "data-card-reading",
      "data-card-compare",
      "data-card-style",
      "data-visual-profile",
      "data-clean-reading",
      "data-value-align",
      "data-label-level",
    ]) {
      expect(attrs.has(k)).toBe(false);
    }
  });

  test("nouvelle apparence : style éditorial et valeurs à droite par défaut", () => {
    const attrs = setupDom();
    const next = { ...DEFAULT_APPEARANCE, ui: "next" as const };
    expect(effectiveCardStyle(next)).toBe("editorial");
    expect(effectiveValueAlign(next)).toBe("right");
    applyAppearance(next);
    expect(attrs.get("data-card-style")).toBe("editorial");
    expect(attrs.get("data-value-align")).toBe("right");
  });

  test("chaque réglage pose son propre attribut", () => {
    const attrs = setupDom();
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      cardReading: "synthetic",
      cardComparisons: false,
      cardStyle: "contour",
      visualProfile: "pilotage",
      cleanReading: true,
      valueAlign: "right",
      labelLevel: "short",
    });
    expect(attrs.get("data-card-reading")).toBe("synthetic");
    expect(attrs.get("data-card-compare")).toBe("off");
    expect(attrs.get("data-card-style")).toBe("contour");
    expect(attrs.get("data-visual-profile")).toBe("pilotage");
    expect(attrs.get("data-clean-reading")).toBe("on");
    expect(attrs.get("data-value-align")).toBe("right");
    expect(attrs.get("data-label-level")).toBe("short");
  });

  test("6 styles de cartes exposés, tous stylés dans la feuille de styles", () => {
    expect(CARD_STYLES.length).toBe(6);
    const css = readFileSync("src/styles.css", "utf8");
    for (const s of CARD_STYLES) {
      expect(css).toContain(`html[data-card-style="${s.value}"] .pp-card`);
    }
  });
});
