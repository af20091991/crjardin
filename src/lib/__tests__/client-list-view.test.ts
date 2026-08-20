import { describe, expect, test } from "bun:test";
import { keepForLifecycle, lostVisible, splitFavorites } from "@/lib/client-list-view";

describe("client-list-view", () => {
  test("clients perdus masqués par défaut", () => {
    expect(keepForLifecycle("perdu", "all", false)).toBe(false);
    expect(keepForLifecycle("actif", "all", false)).toBe(true);
    expect(keepForLifecycle(null, "all", false)).toBe(true);
  });

  test("clients perdus visibles sur demande ou via le filtre dédié", () => {
    expect(keepForLifecycle("perdu", "all", true)).toBe(true);
    expect(keepForLifecycle("perdu", "perdu", false)).toBe(true);
    expect(lostVisible("perdu", false)).toBe(true);
    expect(lostVisible("actif", false)).toBe(false);
  });

  test("un favori n'apparaît jamais dans les autres clients", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const { favorites, others } = splitFavorites(rows, (r) => r.id === "b");
    expect(favorites.map((r) => r.id)).toEqual(["b"]);
    expect(others.map((r) => r.id)).toEqual(["a", "c"]);
  });
});
