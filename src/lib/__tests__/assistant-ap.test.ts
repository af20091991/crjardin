import { describe, expect, it } from "bun:test";
import {
  sortWorksites,
  upcomingFulfillments,
  worksiteCounts,
  worksiteGlobalState,
  type ApStatus,
  type ApWorksite,
} from "@/lib/assistant-ap";

const s = (status: ApStatus) => ({ status });

describe("worksiteGlobalState", () => {
  it("marque « à vérifier » un chantier sans approvisionnement", () => {
    expect(worksiteGlobalState([])).toBe("a_verifier");
  });

  it("priorise « à relancer »", () => {
    expect(worksiteGlobalState([s("ok"), s("a_faire"), s("a_relancer")])).toBe("a_relancer");
  });

  it("signale « à faire » avant « en cours »", () => {
    expect(worksiteGlobalState([s("ok"), s("a_faire"), s("commande_reserve")])).toBe("a_faire");
  });

  it("passe en « en cours » quand tout est engagé sans être livré", () => {
    expect(worksiteGlobalState([s("commande_reserve"), s("retrait_livraison_prevu")])).toBe(
      "en_cours",
    );
  });

  it("passe OK quand tout est OK", () => {
    expect(worksiteGlobalState([s("ok"), s("ok")])).toBe("ok");
  });
});

describe("worksiteCounts", () => {
  it("compte les éléments à traiter et à relancer", () => {
    expect(worksiteCounts([s("ok"), s("a_faire"), s("a_relancer")])).toEqual({
      toHandle: 2,
      toFollowUp: 1,
    });
  });
});

function worksite(partial: Partial<ApWorksite>): ApWorksite {
  return {
    id: partial.id ?? "w",
    client_label: partial.client_label ?? "Chantier",
    scheduled_date: partial.scheduled_date ?? null,
    date_label: null,
    notes: null,
    supplies: partial.supplies ?? [],
  };
}

describe("upcomingFulfillments", () => {
  it("ne retient que les retraits/livraisons datés dans la fenêtre", () => {
    const w = worksite({
      supplies: [
        {
          id: "a",
          worksite_id: "w",
          supplier_id: null,
          quantity: null,
          supplier: "AEF",
          item: "Vivaces",
          status: "retrait_livraison_prevu",
          mode: "livraison",
          fulfillment_date: "2026-10-05",
          comment: null,
        },
        {
          id: "b",
          worksite_id: "w",
          supplier_id: null,
          quantity: null,
          supplier: "Touchat",
          item: "Orgasyl",
          status: "a_faire",
          mode: "retrait",
          fulfillment_date: null,
          comment: null,
        },
        {
          id: "c",
          worksite_id: "w",
          supplier_id: null,
          quantity: null,
          supplier: "Oyas",
          item: "Chanvre",
          status: "ok",
          mode: "stock",
          fulfillment_date: "2026-10-06",
          comment: null,
        },
      ],
    });
    const found = upcomingFulfillments([w], "2026-10-01", 21);
    expect(found.map((f) => f.supply.id)).toEqual(["a"]);
  });
});

describe("sortWorksites", () => {
  it("classe par date et place les chantiers sans date à la fin", () => {
    const list = [
      worksite({ id: "3", client_label: "Sans date" }),
      worksite({ id: "2", client_label: "B", scheduled_date: "2026-11-03" }),
      worksite({ id: "1", client_label: "A", scheduled_date: "2026-10-08" }),
    ];
    expect(sortWorksites(list).map((w) => w.id)).toEqual(["1", "2", "3"]);
  });
});
