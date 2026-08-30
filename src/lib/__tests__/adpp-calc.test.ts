import { describe, expect, it } from "bun:test";
import { evaluateExpression } from "@/lib/adpp/adpp-calc";

describe("ADPP — calcul déterministe", () => {
  it("respecte les priorités et les parenthèses", () => {
    expect(evaluateExpression("2+3*4")).toBe(14);
    expect(evaluateExpression("(2+3)*4")).toBe(20);
  });

  it("calcule une marge en pourcentage", () => {
    expect(evaluateExpression("(12500-8300)/12500*100")).toBeCloseTo(33.6, 6);
  });

  it("gère le signe unaire et les décimales françaises", () => {
    expect(evaluateExpression("-5+2,5")).toBeCloseTo(-2.5, 6);
  });

  it("refuse une expression non arithmétique", () => {
    expect(() => evaluateExpression("process.exit(1)")).toThrow();
  });

  it("refuse une division par zéro", () => {
    expect(() => evaluateExpression("10/0")).toThrow();
  });
});
