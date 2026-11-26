import { describe, expect, it } from "bun:test";
import { isConcernedBySstChange } from "../sst-calendar-recipients";

const admins = new Set(["admin"]);

describe("isConcernedBySstChange", () => {
  it("ne notifie jamais l'auteur", () => {
    expect(
      isConcernedBySstChange(
        { actor_id: "admin", entity: "worksite", owner_id: "u1" },
        "admin",
        admins,
      ),
    ).toBe(false);
  });
  it("disponibilité : tous les membres sauf l'auteur", () => {
    const change = { actor_id: "u1", entity: "availability" as const, owner_id: "u1" };
    expect(isConcernedBySstChange(change, "u2", admins)).toBe(true);
    expect(isConcernedBySstChange(change, "admin", admins)).toBe(true);
  });
  it("chantier : admins + propriétaire seulement", () => {
    const change = { actor_id: "admin", entity: "worksite" as const, owner_id: "u1" };
    expect(isConcernedBySstChange(change, "u1", admins)).toBe(true);
    expect(isConcernedBySstChange(change, "u2", admins)).toBe(false);
    expect(isConcernedBySstChange({ ...change, actor_id: "u1" }, "admin", admins)).toBe(true);
  });
});
