import { describe, expect, test } from "bun:test";
import { archivedConversations, openMessages } from "@/lib/message-threads";

const msg = (id: string, created: string, archived: string | null = null) => ({
  id,
  created_at: created,
  archived_at: archived,
});

describe("conversations Premium", () => {
  const all = [
    msg("a", "2026-09-01T10:00:00Z", "2026-09-05T08:00:00Z"),
    msg("b", "2026-09-02T10:00:00Z", "2026-09-05T08:00:00Z"),
    msg("c", "2026-09-20T10:00:00Z", "2026-09-22T09:00:00Z"),
    msg("d", "2026-10-02T10:00:00Z"),
    msg("e", "2026-10-01T10:00:00Z"),
  ];

  test("la conversation en cours ne contient que les messages non archivés, dans l'ordre", () => {
    expect(openMessages(all).map((m) => m.id)).toEqual(["e", "d"]);
  });

  test("les conversations archivées sont groupées par date de clôture, la plus récente d'abord", () => {
    const groups = archivedConversations(all);
    expect(groups.map((g) => g.messages.map((m) => m.id))).toEqual([["c"], ["a", "b"]]);
    expect(groups[0].archivedAt).toBe("2026-09-22T09:00:00Z");
  });

  test("sans archive, aucune conversation clôturée", () => {
    expect(archivedConversations([msg("x", "2026-10-02T10:00:00Z")])).toEqual([]);
  });
});
