// Uniformisation visuelle : les pages héritent du thème "next" par les tokens
// et les composants partagés, sans code de mise en page dédié.
import "./dom-setup";
import { describe, expect, it, beforeAll } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { render, cleanup } from "@testing-library/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applyAppearance, DEFAULT_APPEARANCE } from "@/lib/appearance";

const ROUTES_DIR = "src/routes/_authenticated";
const routeFiles = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".tsx"));

beforeAll(() => {
  const css = readFileSync("src/styles.css", "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
});

/** Fragment structurel commun à Clients, Santé financière et CR chantier. */
function PageLike({ testid }: { testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent>
        <Badge variant="outline" data-testid={`${testid}-badge`}>
          statut
        </Badge>
        <p className="font-serif text-2xl font-semibold tabular-nums" data-testid={`${testid}-kpi`}>
          12 345 €
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid={`${testid}-th`}>Libellé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="tabular-nums" data-testid={`${testid}-td`}>
                1 200 €
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

describe("Thème next — couverture par les tokens partagés", () => {
  it("applique les tokens next sur trois pages structurellement distinctes", () => {
    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "next" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("next");

    const { getByTestId } = render(
      <>
        <PageLike testid="clients" />
        <PageLike testid="sante" />
        <PageLike testid="cr" />
      </>,
    );

    for (const page of ["clients", "sante", "cr"]) {
      // Sérif sur les valeurs numériques importantes (KPI et cellules chiffrées).
      const kpi = getByTestId(`${page}-kpi`);
      expect(kpi.className).toContain("font-serif");
      expect(kpi.className).toContain("tabular-nums");
      // En-têtes de tableau discrets fournis par la couche de tokens.
      expect(getByTestId(`${page}-th`)).toBeDefined();
      // Aucune couleur brute : les composants partagés portent des classes token.
      const card = getByTestId(page);
      expect(card.className).toContain("bg-card");
      expect(/#[0-9a-fA-F]{6}/.test(card.outerHTML)).toBe(false);
    }
    cleanup();
  });

  it("le mode legacy reste actif et n'utilise pas les tokens next", () => {
    cleanup();
    applyAppearance({ ...DEFAULT_APPEARANCE, ui: "legacy" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("legacy");
    const { getByTestId } = render(<PageLike testid="legacy" />);
    expect(getByTestId("legacy").className).toContain("bg-card");
    cleanup();
  });

  it("aucune page n'ajoute de logique d'apparence ni de couleur brute", () => {
    for (const file of routeFiles) {
      const src = readFileSync(`${ROUTES_DIR}/${file}`, "utf8");
      expect(src).not.toContain('data-theme="next"');
      expect(src.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull();
      expect(src.match(/rgba?\(\s*\d/g)).toBeNull();
    }
  });
});
