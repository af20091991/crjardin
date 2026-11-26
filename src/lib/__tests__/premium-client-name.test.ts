import { describe, expect, test } from "bun:test";
import { formatPremiumClientName, resolvePremiumClientIdentity } from "@/lib/premium-client-name";

describe("identité client Premium", () => {
  test("respecte toujours l'ordre civilité → prénom → nom", () => {
    expect(
      formatPremiumClientName({
        name: "Fournier Anthony",
        civility: "Monsieur",
        firstName: "Anthony",
        lastName: "Fournier",
      }),
    ).toBe("Monsieur Anthony Fournier");
  });

  test("convertit les anciens noms stockés « Nom Prénom »", () => {
    expect(
      formatPremiumClientName({
        name: "Fournier Anthony",
        civility: "Monsieur",
      }),
    ).toBe("Monsieur Anthony Fournier");
  });

  test("conserve une identité sans prénom quand aucune donnée fiable n'existe", () => {
    expect(
      formatPremiumClientName({
        name: "Addala",
        civility: "Monsieur",
      }),
    ).toBe("Monsieur Addala");
  });

  test("normalise les civilités composées", () => {
    const identity = resolvePremiumClientIdentity({
      name: "Martin Sophie",
      civility: "Mme et M.",
    });
    expect(identity.title).toBe("Madame et Monsieur");
    expect(identity.displayName).toBe("Madame et Monsieur Sophie Martin");
  });
});
