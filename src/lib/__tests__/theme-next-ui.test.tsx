import "./dom-setup";
import { describe, expect, it, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { render, cleanup } from "@testing-library/react";
import { KpiCard } from "@/components/pilot/KpiCard";
import { applyAppearance, DEFAULT_APPEARANCE } from "@/lib/appearance";
import type { LucideIcon } from "lucide-react";

beforeAll(() => {
  const css = readFileSync("src/styles.css", "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
});

const categoryIcon = ((props: { className?: string }) => (
  <svg
    data-testid="category-icon"
    viewBox="0 0 24 24"
    className={props.className ?? "h-4 w-4"}
  />
)) as unknown as LucideIcon;

describe("Thème next — aplatissement des cartes KPI et allègement des icônes", () => {
  it("KpiCard inclut les classes d'icône et d'actions sous next et legacy", () => {
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
    expect(container.querySelector(".kpi-card")).not.toBeNull();
    expect(container.querySelector(".kpi-category-icon")).not.toBeNull();
    expect(container.querySelector(".kpi-card-actions")).not.toBeNull();
    expect(container.querySelectorAll(".kpi-card-actions button").length).toBe(2);
  });

  it("CSS next masque l'icône de catégorie et rend les actions discrètes", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const block = css.match(
      /\[data-theme="next"\]\s+\.kpi-card\s+\.kpi-category-icon\s*\{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("display: none");

    const actionsDefault = css.match(
      /\[data-theme="next"\]\s+\.kpi-card-actions\s*\{[^}]*\}/,
    );
    expect(actionsDefault).not.toBeNull();
    expect(actionsDefault![0]).toContain("opacity: 0");

    const actionsHover = css.match(
      /\[data-theme="next"\]\s+\.kpi-card:hover\s+\.kpi-card-actions\s*,\s*\[data-theme="next"\]\s+\.kpi-card:focus-within\s+\.kpi-card-actions\s*\{[^}]*\}/,
    );
    expect(actionsHover).not.toBeNull();
    expect(actionsHover![0]).toContain("opacity: 1");
  });

  it("CSS legacy ne masque pas les icônes de catégorie ni les actions", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const legacyIcon = css.match(
      /\[data-theme="legacy"\]\s+\.kpi-card\s+\.kpi-category-icon\s*\{[^}]*display:\s*none[^}]*\}/,
    );
    expect(legacyIcon).toBeNull();
    const legacyActions = css.match(
      /\[data-theme="legacy"\]\s+\.kpi-card-actions\s*\{[^}]*opacity:\s*0[^}]*\}/,
    );
    expect(legacyActions).toBeNull();
  });

  it("CSS next applique les cartes plates avec un filet en bas", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const block = css.match(/\[data-theme="next"\]\s+\.bg-card\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    const rule = block![0];
    expect(rule).toContain("border-radius: 0");
    expect(rule).toContain("box-shadow: none");
    expect(rule).toContain("border-bottom: 1px solid var(--border)");
  });
});

describe("Thème next — sidebar texte seul", () => {
  it("CSS next masque les icônes de navigation et retire le gap", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const iconRule = css.match(
      /\[data-theme="next"\]\s+aside\s+nav\s+a\s+\.nav-link-icon\s*\{[^}]*\}/,
    );
    expect(iconRule).not.toBeNull();
    expect(iconRule![0]).toContain("display: none");

    const gapRule = css.match(/\[data-theme="next"\]\s+aside\s+nav\s+a\s*\{[^}]*\}/);
    expect(gapRule).not.toBeNull();
    expect(gapRule![0]).toContain("gap: 0");
  });

  it("les liens de navigation restent structurés avec texte et icône dans le DOM", () => {
    cleanup();
    const { container } = render(
      <a className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium" href="/test">
        <svg className="nav-link-icon h-5 w-5" />
        <span className="nav-text">Lien</span>
      </a>,
    );
    expect(container.querySelector(".nav-link-icon")).not.toBeNull();
    expect(container.querySelector(".nav-text")).not.toBeNull();
    expect(container.textContent).toContain("Lien");
  });
});
