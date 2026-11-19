import { describe, expect, it } from "bun:test";
import { isPrestatairePathAllowed } from "@/lib/prestataire-access";

describe("accès prestataire", () => {
  it("autorise ses missions, ses fiches SST et le calendrier SST", () => {
    expect(isPrestatairePathAllowed("/sst")).toBe(true);
    expect(isPrestatairePathAllowed("/fiches/abc")).toBe(true);
    expect(isPrestatairePathAllowed("/pilot/calendrier")).toBe(true);
  });

  it("refuse la carte de tous les clients et les écrans de gestion", () => {
    expect(isPrestatairePathAllowed("/pilot/mapping")).toBe(false);
    expect(isPrestatairePathAllowed("/pilot/dashboard")).toBe(false);
    expect(isPrestatairePathAllowed("/pilot/ca")).toBe(false);
    expect(isPrestatairePathAllowed("/fiches/new")).toBe(false);
  });
});
