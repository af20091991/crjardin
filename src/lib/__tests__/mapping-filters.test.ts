import { describe, expect, test } from "bun:test";
import { EMPTY_FILTERS, NOT_SET, matchesFilters, type MappingClient } from "../mapping";

const client = (over: Partial<MappingClient>): MappingClient => ({
  id: "1",
  name: "Test",
  address: null,
  phone: null,
  email: null,
  lifecycle_status: "actif",
  contract_type: "Ponctuel",
  frequency: null,
  ...over,
});

describe("filtres du module Mapping", () => {
  test("sans filtre, tout passe", () => {
    expect(matchesFilters(client({}), EMPTY_FILTERS)).toBe(true);
  });
  test("filtre sur le statut", () => {
    const f = { ...EMPTY_FILTERS, lifecycle: new Set(["actif"]) };
    expect(matchesFilters(client({}), f)).toBe(true);
    expect(matchesFilters(client({ lifecycle_status: "perdu" }), f)).toBe(false);
  });
  test("critères combinés et valeurs non renseignées", () => {
    const f = {
      ...EMPTY_FILTERS,
      contract: new Set(["Ponctuel"]),
      frequency: new Set([NOT_SET]),
    };
    expect(matchesFilters(client({}), f)).toBe(true);
    expect(matchesFilters(client({ frequency: "Mensuelle" }), f)).toBe(false);
    expect(matchesFilters(client({ contract_type: "" }), f)).toBe(false);
  });
});
