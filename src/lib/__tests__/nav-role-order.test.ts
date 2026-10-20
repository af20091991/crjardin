import { describe, expect, it } from "bun:test";
import { orderGroupsForRole } from "@/components/AppShell";

const groups = ["Entreprise", "Financier", "Client", "Activité", "Configuration"].map((label) => ({
  label,
}));

describe("menu par profil", () => {
  it("l'administrateur voit toutes les rubriques, dans l'ordre d'origine", () => {
    expect(orderGroupsForRole(groups, "admin").map((g) => g.label)).toEqual(
      groups.map((g) => g.label),
    );
  });
  it("le prestataire retrouve l'activité en premier sans perdre de rubrique", () => {
    const ordered = orderGroupsForRole(groups, "prestataire").map((g) => g.label);
    expect(ordered[0]).toBe("Activité");
    expect([...ordered].sort()).toEqual(groups.map((g) => g.label).sort());
  });
});
