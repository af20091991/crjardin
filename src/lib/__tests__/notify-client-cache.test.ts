// Vérification des clés de cache invalidées par notifyClient et de l'affichage
// du statut d'envoi sur les fiches client.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("notifyClient — invalidation des fiches client", () => {
  const src = readFileSync("src/routes/_authenticated/interventions.$interventionId.tsx", "utf8");

  test("invalide la liste des interventions du client classique", () => {
    expect(src).toContain('qc.invalidateQueries({ queryKey: ["interventions", client.id] })');
  });

  test("invalide la liste des interventions du client sur Pilot Pro", () => {
    expect(src).toContain('qc.invalidateQueries({ queryKey: ["fiche-interventions", client.id] })');
  });

  test("ne dépend que du client_id déjà disponible dans le contexte", () => {
    expect(src).toContain("if (client?.id) {");
  });
});

describe("fiche client classique — badge d'envoi par intervention", () => {
  const src = readFileSync("src/routes/_authenticated/clients.$clientId.tsx", "utf8");

  test("affiche « Envoyé au client » quand sent_to_client_at est renseigné", () => {
    expect(src).toContain("Envoyé au client");
    expect(src).toContain("{iv.sent_to_client_at && (");
  });

  test("conserve le badge Terminé / Brouillon existant", () => {
    expect(src).toContain('iv.status === "terminee" ? "Terminé" : "Brouillon"');
  });

  test("ne modifie pas le badge global CR en haut de page", () => {
    expect(src).toContain("{(interventions ?? []).some((iv) => iv.sent_to_client_at) && (");
    expect(src).toContain('variant="outline" className="border-primary/40 text-primary">CR');
  });
});

describe("fiche client Pilot Pro — badge d'envoi déjà géré", () => {
  const src = readFileSync("src/routes/_authenticated/pilot.fiche.$clientId.tsx", "utf8");

  test("affiche déjà « CR envoyé » pour les interventions envoyées", () => {
    expect(src).toContain('if (iv.sent_to_client_at) return { label: "CR envoyé", color: "#4F8E33" }');
  });
});
