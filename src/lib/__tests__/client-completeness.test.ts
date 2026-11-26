import { describe, expect, it } from "bun:test";
import { buildCompleteness, type CompletenessInput } from "@/lib/client-completeness";

const base: CompletenessInput = {
  client: {
    email: null,
    emails: [],
    phone: null,
    address: null,
    contract_type: null,
    frequency: null,
    ceev_planning_path: null,
  },
  premiumEnabled: false,
  premium: null,
  workCalendarCount: 0,
  interventionCount: 0,
  recoCount: 0,
};

describe("buildCompleteness", () => {
  it("liste les éléments manquants d'une fiche vide", () => {
    const r = buildCompleteness(base);
    expect(r.missing.map((i) => i.id)).toContain("email");
    expect(r.missing.map((i) => i.id)).toContain("intervention");
    expect(r.done).toBe(0);
  });

  it("accepte une adresse e-mail dans la liste des e-mails", () => {
    const r = buildCompleteness({
      ...base,
      client: { ...base.client, emails: ["a@b.fr"] },
    });
    expect(r.missing.map((i) => i.id)).not.toContain("email");
  });

  it("exige le planning PDF seulement pour un contrat d'entretien annuel", () => {
    const sans = buildCompleteness({
      ...base,
      client: { ...base.client, contract_type: "Ponctuel" },
    });
    const avec = buildCompleteness({
      ...base,
      client: { ...base.client, contract_type: "Entretien annuel" },
    });
    expect(sans.items.find((i) => i.id === "planning")?.required).toBe(false);
    expect(avec.items.find((i) => i.id === "planning")?.required).toBe(true);
  });

  it("ajoute les contrôles Premium seulement quand Premium est actif", () => {
    const off = buildCompleteness(base);
    const on = buildCompleteness({ ...base, premiumEnabled: true });
    expect(off.items.some((i) => i.scope === "premium")).toBe(false);
    expect(on.items.filter((i) => i.scope === "premium").map((i) => i.id)).toEqual([
      "calendar",
      "cover",
      "note",
      "google",
    ]);
  });

  it("considère la couverture atteinte par photo ou par document", () => {
    const r = buildCompleteness({
      ...base,
      premiumEnabled: true,
      premium: {
        cover_photo_id: null,
        cover_document_id: "doc",
        commercial_note: null,
        google_review_url: null,
      },
    });
    expect(r.items.find((i) => i.id === "cover")?.done).toBe(true);
  });
});
