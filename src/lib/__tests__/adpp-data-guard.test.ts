import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const contextSource = readFileSync("src/lib/adpp/adpp-context.server.ts", "utf8");
const assistantSource = readFileSync("src/lib/adpp.functions.ts", "utf8");

describe("ADPP data guard", () => {
  it("does not query the removed CA status column", () => {
    expect(contextSource).toContain('.select("year,month,kind,designation,category,amount_ht,hours")');
    expect(contextSource).not.toContain('.select("year,month,kind,designation,category,amount_ht,hours,status")');
  });

  it("fails the snapshot when any Pilot Pro query fails", () => {
    expect(contextSource).toContain("const queryErrors = [");
    expect(contextSource).toContain("throw new Error(`Données Pilot Pro indisponibles");
  });

  it("forbids financial zero substitution after pilot_data failure", () => {
    expect(assistantSource).toContain("Les chiffres financiers sont indisponibles. Ne donne aucun montant ni zéro de substitution.");
    expect(assistantSource).toContain("N'utilise jamais 0, une valeur vide ou une ancienne valeur comme substitut.");
  });
});
