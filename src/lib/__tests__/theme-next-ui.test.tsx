import "./dom-setup";
import { describe, expect, it, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { KpiCard } from "@/components/pilot/KpiCard";
import { applyAppearance, DEFAULT_APPEARANCE } from "@/lib/appearance";

beforeAll(() => {
  const css = readFileSync("src/styles.css", "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
});

function categoryIcon() {
  return <svg data-testid="category-icon" viewBox="0 0 24 24" className="h-4 w-4" />;
}

describe("Thème next — aplatissement des cartes KPI et allègement des icônes", () => {
  it("masque l'icône de catégorie sous next et la garde sous legacy", () => {
    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "next" });
    const { container, rerender } = render(
      <KpiCard label="CA" value="12 345 €" icon={categoryIcon} />,
    );
    const card = container.querySelector(".kpi-card");
    expect(card).not.toBeNull();
    const catIcon = container.querySelector(".kpi-category-icon");
    expect(catIcon).not.toBeNull();
    expect(window.getComputedStyle(catIcon!).display).toBe("none");

    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "legacy" });
    const { container: legacyContainer } = render(
      <KpiCard label="CA" value="12 345 €" icon={categoryIcon} />,
    );
    const legacyIcon = legacyContainer.querySelector(".kpi-category-icon");
    expect(legacyIcon).not.toBeNull();
    expect(window.getComputedStyle(legacyIcon!).display).not.toBe("none");
  });

  it("les actions Masquer/Changer de vue sont dans le DOM mais discrètes sous next", () => {
    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "next" });
    const { container } = render(
      <KpiCard
        label="CA"
        value="12 345 €"
        icon={categoryIcon}
        views={[
          { key: "a", label: "Vue A", value: "1" },
          { key: "b", label: "Vue B", value: "2" },
        ]}
      />,
    );
    const actions = container.querySelector(".kpi-card-actions");
    expect(actions).not.toBeNull();
    expect(actions!.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
    expect(window.getComputedStyle(actions!).opacity).toBe("0");

    fireEvent.mouseEnter(container.querySelector(".kpi-card")!);
    expect(window.getComputedStyle(actions!).opacity).toBe("1");
  });

  it("les actions restent visibles par défaut sous legacy", () => {
    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "legacy" });
    const { container } = render(
      <KpiCard
        label="CA"
        value="12 345 €"
        icon={categoryIcon}
        views={[
          { key: "a", label: "Vue A", value: "1" },
          { key: "b", label: "Vue B", value: "2" },
        ]}
      />,
    );
    const actions = container.querySelector(".kpi-card-actions");
    expect(actions).not.toBeNull();
    expect(window.getComputedStyle(actions!).opacity).toBe("1");
  });

  it("la carte est plate sous next (pas d'ombre, pas d'arrondi, filet en bas)", () => {
    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "next" });
    const { container } = render(<KpiCard label="CA" value="12 345 €" />);
    const card = container.querySelector(".bg-card");
    expect(card).not.toBeNull();
    const style = window.getComputedStyle(card!);
    expect(style.borderRadius).toBe("0px");
    expect(style.boxShadow).toBe("none");
    expect(style.borderBottomWidth).toBe("1px");
  });
});

describe("Thème next — sidebar texte seul", () => {
  it("les icônes de navigation sont masquées sous next et présentes sous legacy", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const nextRule = css.match(/\[data-theme="next"\]\s+aside\s+nav\s+a\s+\.nav-link-icon\s*\{[^}]*\}/);
    expect(nextRule).not.toBeNull();
    expect(nextRule![0]).toContain("display: none");

    const legacyRule = css.match(/\[data-theme="legacy"\]\s+aside\s+nav\s+a\s+\.nav-link-icon/);
    expect(legacyRule).toBeNull();
  });
});
