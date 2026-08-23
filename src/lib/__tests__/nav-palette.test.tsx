// Rendu réel : palette de commande sur les liens existants de la sidebar.
import "./dom-setup";
import { describe, expect, it } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NavCommandPalette, filterNavItems, DEFAULT_OPEN_GROUP } from "@/components/AppShell";

const items = [
  { to: "/pilot", label: "Centre de décision", short: "Accueil" },
  { to: "/pilot/ca", label: "Chiffre d'affaires", short: "CA" },
  { to: "/clients", label: "Fiches clients", short: "Clients" },
  { to: "/interventions", label: "CR chantier", short: "CR" },
];

function renderPalette() {
  const visited: string[] = [];
  const utils = render(
    <NavCommandPalette
      items={items}
      open
      onOpenChange={() => {}}
      onNavigate={(to) => visited.push(to)}
    />,
  );
  return { visited, ...utils };
}

describe("palette de commande", () => {
  it("un seul bloc de la sidebar est ouvert par défaut", () => {
    expect(DEFAULT_OPEN_GROUP).toBe("Aujourd'hui");
  });

  it("filtre les liens existants sans en inventer", () => {
    expect(filterNavItems(items, "client").map((i) => i.to)).toEqual(["/clients"]);
    expect(filterNavItems(items, "affaires").map((i) => i.to)).toEqual(["/pilot/ca"]);
    expect(filterNavItems(items, "").length).toBe(items.length);
  });

  it("taper un terme réduit la liste affichée", () => {
    cleanup();
    const { container } = renderPalette();
    expect(container.querySelectorAll("[data-nav-palette-item]").length).toBe(4);
    fireEvent.change(screen.getByLabelText("Rechercher un écran"), {
      target: { value: "chantier" },
    });
    const shown = [...container.querySelectorAll("[data-nav-palette-item]")].map((n) =>
      n.getAttribute("data-nav-palette-item"),
    );
    expect(shown).toEqual(["/interventions"]);
    cleanup();
  });

  it("Entrée navigue vers l'élément sélectionné (flèches incluses)", () => {
    cleanup();
    const { visited, container } = renderPalette();
    const dialog = container.querySelector('[data-nav-palette="root"]')!;
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(visited).toEqual(["/pilot/ca"]);

    fireEvent.change(screen.getByLabelText("Rechercher un écran"), { target: { value: "fiches" } });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(visited).toEqual(["/pilot/ca", "/clients"]);
    cleanup();
  });
});
