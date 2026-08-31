import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
const fixCss = readFileSync("src/styles/finance-chart-fixes.css", "utf8");

describe("finance chart axis labels", () => {
  it("loads the scoped finance chart fix stylesheet", () => {
    expect(rootSource).toContain('financeChartFixesCss from "../styles/finance-chart-fixes.css?url"');
    expect(rootSource).toContain('{ rel: "stylesheet", href: financeChartFixesCss }');
  });

  it("scopes duplicate tick-unit suppression to the Finance route", () => {
    expect(fixCss).toContain('html[data-route="/pilot/finance"]');
    expect(fixCss).toContain("tspan + tspan");
  });
});
