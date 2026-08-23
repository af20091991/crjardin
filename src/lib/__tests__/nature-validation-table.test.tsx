// Rendu réel : le tableau affiche plusieurs lignes en même temps + pagination.
import "./dom-setup";
import { describe, expect, it } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NatureValidationTable } from "@/components/pilot/panels/NatureValidationTable";
import type { NatureLine } from "@/lib/pilot-nature-validation";

const rows: NatureLine[] = Array.from({ length: 30 }, (_, i) => ({
  id: `L${i + 1}`,
  year: 2026,
  month: (i % 12) + 1,
  designation: `Ligne ${i + 1}`,
  amount: 100 + i,
  kind: i % 2 ? "vente" : "charge",
  currentClass: "a_classer",
  placement: i % 2 ? "Encart Ventes" : "Encart Charges",
}));

function renderTable(data: NatureLine[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NatureValidationTable rows={data} />
    </QueryClientProvider>,
  );
}

describe("NatureValidationTable — tableau paginé", () => {
  it("affiche 25 lignes simultanément dans un tableau", () => {
    cleanup();
    const { container } = renderTable(rows);
    expect(container.querySelectorAll("table tbody tr").length).toBe(25);
    expect(screen.getByText("Ligne 1")).toBeDefined();
    expect(screen.getByText("Ligne 25")).toBeDefined();
    cleanup();
  });

  it("propose un choix de nature sur chaque ligne", () => {
    cleanup();
    const { container } = renderTable(rows.slice(0, 3));
    const firstRow = container.querySelector('[data-nature-row="L1"]')!;
    const labels = [...firstRow.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual(["Vente", "Charge variable", "Charge fixe"]);
    cleanup();
  });

  it("« Afficher 25 lignes de plus » révèle le reste", () => {
    cleanup();
    const { container } = renderTable(rows);
    fireEvent.click(screen.getByText("Afficher 25 lignes de plus"));
    expect(container.querySelectorAll("table tbody tr").length).toBe(30);
    cleanup();
  });
});
