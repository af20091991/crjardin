// Certification des rattachements CA → client : moteur déterministe.
import { describe, expect, test } from "bun:test";
import {
  buildAttachmentCertification,
  type CertificationClient,
} from "@/lib/pilot-attachment-certification";

const CLIENTS: CertificationClient[] = [
  { id: "c1", name: "Adagios", entity_status: "certified_client" },
  { id: "c2", name: "Maurice", entity_status: "manual_review_required" },
  { id: "c3", name: "Bodard", entity_status: "manual_review_required", duplicateNames: ["Bodard SCI"] },
  { id: "c4", name: "Fusionnée", entity_status: "manual_review_required", merged_into_client_id: "c1" },
];

function build(sales: Array<Partial<{ id: string; client_id: string | null; designation: string | null; amount_ht: number | null }>>) {
  return buildAttachmentCertification({
    periode: "2026 — à date",
    clients: CLIENTS,
    sales: sales.map((s, i) => ({
      id: s.id ?? `s${i}`,
      client_id: s.client_id ?? null,
      designation: s.designation ?? null,
      amount_ht: s.amount_ht ?? 100,
    })),
  });
}

describe("buildAttachmentCertification", () => {
  test("fiche certifiée + nom cohérent : rattachement certifié", () => {
    const r = build([{ client_id: "c1", designation: "SAP Adagios" }]);
    expect(r.sales[0].verdict).toBe("rattachement_certifie");
    expect(r.status).toBe("certifie");
    expect(r.certifiedAmount).toBe(100);
  });

  test("fiche non certifiée mais rattachement unique : certifiable en l'état", () => {
    const r = build([{ client_id: "c2", designation: "Maurice" }]);
    expect(r.sales[0].verdict).toBe("rattachement_demontrable");
    expect(r.status).toBe("incomplet");
    expect(r.clients[0].certifiable).toBe(true);
  });

  test("client absent de la ligne : indisponible, jamais deviné", () => {
    const r = build([{ client_id: null, designation: "Maurice" }]);
    expect(r.sales[0].verdict).toBe("client_absent");
    expect(r.status).toBe("indisponible");
  });

  test("identifiant inconnu : référence invalide", () => {
    const r = build([{ client_id: "zzz", designation: "Maurice" }]);
    expect(r.sales[0].verdict).toBe("reference_invalide");
  });

  test("doublon possible ou fiche fusionnée : jamais certifié", () => {
    const r = build([
      { client_id: "c3", designation: "Bodard" },
      { client_id: "c4", designation: "Fusionnée" },
    ]);
    expect(r.sales.map((s) => s.verdict)).toEqual(["doublon_client", "doublon_client"]);
    expect(r.clients.every((c) => c.certifiable === false)).toBe(true);
  });

  test("désignation étrangère au nom de fiche : nom non rapproché", () => {
    const r = build([{ client_id: "c2", designation: "Mairie du Bourg" }]);
    expect(r.sales[0].verdict).toBe("nom_non_rapproche");
  });

  test("montant absent : donnée incomplète", () => {
    const r = build([{ client_id: "c2", designation: "Maurice", amount_ht: 0 }]);
    expect(r.sales[0].verdict).toBe("donnee_incomplete");
  });

  test("plusieurs fiches homonymes : rattachement ambigu, aucune certification", () => {
    const r = buildAttachmentCertification({
      periode: "2026",
      clients: [
        { id: "a", name: "Dupont", entity_status: "manual_review_required" },
        { id: "b", name: "Dupont", entity_status: "manual_review_required" },
      ],
      sales: [{ id: "s1", client_id: "a", designation: "Dupont", amount_ht: 500 }],
    });
    expect(r.sales[0].verdict).toBe("client_ambigu");
    expect(r.sales[0].candidates).toContain("Dupont");
    expect(r.status).toBe("suspect");
  });

  test("aucune ligne : certification indisponible", () => {
    expect(build([]).status).toBe("indisponible");
  });
});