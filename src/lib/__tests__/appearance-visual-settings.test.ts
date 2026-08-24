import { describe, expect, test, beforeEach } from "vitest";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  FONT_GROUPS,
  FONT_OPTIONS,
  FONT_STACKS,
  type Appearance,
} from "@/lib/appearance";
import { startOfWeek, getWeekStartDay } from "@/lib/date-utils";

/** DOM minimal : suffit pour vérifier attributs et variables inline. */
function setupDom() {
  const attrs = new Map<string, string>();
  const styles = new Map<string, string>();
  const root = {
    classList: { toggle: () => {} },
    style: {
      setProperty: (k: string, v: string) => styles.set(k, v),
      removeProperty: (k: string) => styles.delete(k),
    },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
  };
  (globalThis as any).document = { documentElement: root };
  (globalThis as any).window = { matchMedia: () => ({ matches: false }) };
  return { attrs, styles };
}

const ALLOWED_FAMILIES = [
  "Plus Jakarta Sans",
  "Inter",
  "Work Sans",
  "Manrope",
  "Outfit",
  "Sora",
  "Space Grotesk",
  "DM Sans",
  "Poppins",
  "Nunito",
  "Quicksand",
  "Newsreader",
  "Fraunces",
  "Lora",
  "Source Serif 4",
  "Playfair Display",
  "Cormorant Garamond",
  "Libre Baskerville",
  "Spectral",
  "PT Serif",
  "Roboto Slab",
  "Syne",
  "JetBrains Mono",
  "IBM Plex Mono",
  "Space Mono",
];

describe("catalogue de polices", () => {
  test("expose exactement 25 familles + auto + système", () => {
    expect(FONT_OPTIONS.length).toBe(27);
    expect(FONT_GROUPS.flatMap((g) => g.options).length).toBe(27);
  });

  test("aucune police hors liste", () => {
    for (const [key, stack] of Object.entries(FONT_STACKS)) {
      if (key === "system") continue;
      const family = stack.match(/^"([^"]+)"/)?.[1];
      expect(ALLOWED_FAMILIES).toContain(family!);
    }
  });
});

describe("non-régression : valeurs par défaut", () => {
  test("aucun attribut de réglage additionnel n'est posé", () => {
    const { attrs, styles } = setupDom();
    applyAppearance(DEFAULT_APPEARANCE);
    for (const key of [
      "data-border-width",
      "data-card-hover",
      "data-button-radius",
      "data-contrast",
      "data-text-scale",
      "data-motion",
      "data-table-density",
      "data-content-width",
      "data-deco-icons",
      "data-nav-indicator",
      "data-accent-sat",
      "data-dark-tint",
      "data-font-heading",
      "data-font-numeric",
    ]) {
      expect(attrs.has(key)).toBe(false);
    }
    expect(styles.has("--text-scale")).toBe(false);
    expect(styles.has("--radius-button")).toBe(false);
    expect(getWeekStartDay()).toBe(1);
    // Les réglages historiques restent posés à l'identique.
    expect(attrs.get("data-density")).toBe("comfortable");
    expect(attrs.get("data-skin")).toBe("classic");
    expect(attrs.get("data-theme")).toBe("legacy");
  });
});

describe("chaque réglage n'agit que sur sa propre variable", () => {
  const cases: { patch: Partial<Appearance>; attr?: [string, string]; cssVar?: [string, string] }[] =
    [
      { patch: { borderWidth: "strong" }, attr: ["data-border-width", "strong"] },
      { patch: { cardHoverShadow: true }, attr: ["data-card-hover", "shadow"] },
      { patch: { buttonRadius: 0.3 }, cssVar: ["--radius-button", "0.3rem"] },
      { patch: { highContrast: true }, attr: ["data-contrast", "high"] },
      { patch: { textScale: "large" }, cssVar: ["--text-scale", "1.06"] },
      { patch: { reducedMotion: true }, attr: ["data-motion", "reduced"] },
      { patch: { tableDensity: "compact" }, attr: ["data-table-density", "compact"] },
      { patch: { contentWidth: "full" }, attr: ["data-content-width", "full"] },
      { patch: { decorativeIcons: false }, attr: ["data-deco-icons", "off"] },
      { patch: { navIndicator: "dot" }, attr: ["data-nav-indicator", "dot"] },
      { patch: { accentSaturation: "soft" }, attr: ["data-accent-sat", "soft"] },
      { patch: { darkTint: "neutral" }, attr: ["data-dark-tint", "neutral"] },
    ];

  for (const c of cases) {
    test(`${Object.keys(c.patch)[0]}`, () => {
      const base = setupDom();
      applyAppearance(DEFAULT_APPEARANCE);
      const refAttrs = new Map(base.attrs);
      const refStyles = new Map(base.styles);

      const next = setupDom();
      applyAppearance({ ...DEFAULT_APPEARANCE, ...c.patch });

      if (c.attr) {
        expect(next.attrs.get(c.attr[0])).toBe(c.attr[1]);
        next.attrs.delete(c.attr[0]);
      }
      if (c.cssVar) {
        expect(next.styles.get(c.cssVar[0])).toBe(c.cssVar[1]);
        next.styles.delete(c.cssVar[0]);
        if (c.cssVar[0] === "--radius-button") next.attrs.delete("data-button-radius");
        if (c.cssVar[0] === "--text-scale") next.attrs.delete("data-text-scale");
      }
      // Rien d'autre n'a bougé.
      expect([...next.attrs.entries()].sort()).toEqual([...refAttrs.entries()].sort());
      expect([...next.styles.entries()].sort()).toEqual([...refStyles.entries()].sort());
    });
  }
});

describe("polices : Système retire toute police personnalisée", () => {
  test("system pose une pile sans famille Google", () => {
    const { attrs, styles } = setupDom();
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      fontHeading: "system",
      fontBody: "system",
      fontNumeric: "system",
    });
    expect(styles.get("--font-heading")).toBe(FONT_STACKS.system);
    expect(styles.get("--font-sans")).toBe(FONT_STACKS.system);
    expect(styles.get("--font-numeric")).toBe(FONT_STACKS.system);
    expect(FONT_STACKS.system).not.toContain('"');
    expect(attrs.get("data-font-heading")).toBe("custom");
  });

  test("retour à auto nettoie les variables", () => {
    const { attrs, styles } = setupDom();
    applyAppearance({ ...DEFAULT_APPEARANCE, fontHeading: "fraunces" });
    applyAppearance(DEFAULT_APPEARANCE);
    expect(styles.has("--font-heading")).toBe(false);
    expect(attrs.has("data-font-heading")).toBe(false);
  });
});

describe("premier jour de la semaine", () => {
  beforeEach(() => setupDom());

  test("auto = lundi (comportement historique)", () => {
    applyAppearance(DEFAULT_APPEARANCE);
    // 2026-08-24 est un lundi.
    expect(startOfWeek(new Date("2026-08-26T12:00:00")).getDate()).toBe(24);
  });

  test("dimanche décale le début de semaine", () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, weekStart: "sunday" });
    expect(startOfWeek(new Date("2026-08-26T12:00:00")).getDate()).toBe(23);
    applyAppearance(DEFAULT_APPEARANCE);
  });
});
