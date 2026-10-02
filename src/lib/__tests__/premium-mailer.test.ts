import { describe, expect, test } from "bun:test";
import { collectClientEmails } from "@/lib/premium-mailer.server";

describe("destinataires Premium", () => {
  test("reprend toutes les adresses de la fiche client, sans doublon", () => {
    expect(
      collectClientEmails({
        email: "michele.bodard@sfr.fr",
        emails: [
          "michele.bodard@sfr.fr",
          "nelly.francois@live.fr",
          " a.fradin@conseil-invest34.com ",
        ],
      }),
    ).toEqual(["michele.bodard@sfr.fr", "nelly.francois@live.fr", "a.fradin@conseil-invest34.com"]);
  });

  test("gère une fiche sans adresse", () => {
    expect(collectClientEmails({ email: null, emails: [] })).toEqual([]);
    expect(collectClientEmails({ email: "a@b.fr", emails: null })).toEqual(["a@b.fr"]);
  });
});
