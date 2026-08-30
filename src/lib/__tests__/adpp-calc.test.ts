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

  it("refuse une expression non arithmétique et la division par zéro", () => {
    const failed = (expression: string) => {
      try {
        evaluateExpression(expression);
        return false;
      } catch {
        return true;
      }
    };
    expect(failed("process.exit(1)")).toBe(true);
    expect(failed("10/0")).toBe(true);
  });
});
