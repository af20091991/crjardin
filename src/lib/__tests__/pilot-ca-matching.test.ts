// Rapprochement CA → client : le moteur ne doit JAMAIS deviner un rattachement.
import { describe, expect, test } from "bun:test";
import {
  buildDesignationIndex,
  entryConfidence,
  levenshtein,
  normalizeLabel,
  similarity,
  suggestClients,
} from "@/lib/pilot-ca-matching";
import type { Client } from "@/lib/clients";

function client(id: string, name: string, over: Partial<Client> = {}): Client {
  return {
    id,
    name,
    civility: null,
    address: null,
    phone: null,
    email: null,
    emails: [],
    contract_type: null,
    frequency: null,
    notes: null,
    report_policy: "a_confirmer",
    lifecycle_status: "actif",
    lost_at: null,
    source: null,
    source_confidence: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    share_token: `t-${id}`,
    ...over,
  } as Client;
}

const CLIENTS = [client("c1", "Adagios"), client("c2", "Maurice"), client("c3", "Bodard")];
const EMPTY_INDEX = new Map<string, { clientId: string; count: number }>();

describe("normalisation et similarité", () => {
  test("normalisation accents / ponctuation / casse", () => {
    expect(normalizeLabel("  ÉCO-Jardin, SARL ")).toBe("eco jardin sarl");
  });

  test("similarité identique = 1, chaîne vide = 0", () => {
    expect(similarity("Adagios", "adagios")).toBe(1);
    expect(similarity("", "Adagios")).toBe(0);
  });

  test("Levenshtein distingue les faux amis", () => {
    expect(levenshtein("mauric", "maurice")).toBe(1);
    expect(levenshtein("adagios", "adagios")).toBe(0);
  });
});

describe("suggestClients", () => {
  test("désignation vide : aucune suggestion", () => {
    expect(suggestClients({ designation: "" }, CLIENTS, EMPTY_INDEX)).toEqual([]);
    expect(entryConfidence([])).toBe("faible");
  });

  test("correspondance exacte : confiance haute", () => {
    const [best] = suggestClients({ designation: "Adagios" }, CLIENTS, EMPTY_INDEX);
    expect(best.client.id).toBe("c1");
    expect(best.reason).toBe("exact");
    expect(best.confidence).toBe("haute");
    expect(best.score).toBe(1);
  });

  test("historique validé : rattachement de confiance haute", () => {
    const index = buildDesignationIndex([
      { designation: "REE 12 Adagios", client_id: "c1" },
      { designation: "REE 12 Adagios", client_id: "c1" },
    ]);
    expect(index.get("ree 12 adagios")).toEqual({ clientId: "c1", count: 2 });
    const [best] = suggestClients({ designation: "REE 12 Adagios" }, CLIENTS, index);
    expect(best.client.id).toBe("c1");
    expect(best.reason).toBe("historique");
    expect(best.confidence).toBe("haute");
  });

  test("orthographe proche mais différente : jamais de confiance haute", () => {
    const out = suggestClients({ designation: "Mauric" }, CLIENTS, EMPTY_INDEX);
    const hit = out.find((s) => s.client.id === "c2");
    expect(hit).toBeDefined();
    expect(hit!.confidence).not.toBe("haute");
  });

  test("aucun client ressemblant : aucune suggestion produite", () => {
    expect(suggestClients({ designation: "Zzzzzzzz Qqqq" }, CLIENTS, EMPTY_INDEX)).toEqual([]);
  });

  test("index de désignation : les lignes orphelines n'entrent jamais dans l'historique", () => {
    const index = buildDesignationIndex([
      { designation: "Adagios", client_id: null },
      { designation: null, client_id: "c1" },
    ]);
    expect(index.size).toBe(0);
  });
});
