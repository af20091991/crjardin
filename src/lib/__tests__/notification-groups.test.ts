import { describe, expect, it } from "bun:test";
import { groupNotifications, notificationTarget } from "@/lib/notification-groups";
import type { AppNotification } from "@/lib/notifications";

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: "1",
  type: "info",
  title: "t",
  body: null,
  client_id: null,
  intervention_id: null,
  is_read: false,
  created_at: "2026-10-29T10:00:00Z",
  ...over,
});

describe("notification-groups", () => {
  it("regroupe par catégorie dans l'ordre SST, Clients, Autres", () => {
    const g = groupNotifications([
      n({ id: "a", type: "info" }),
      n({ id: "b", type: "question", client_id: "c1" }),
      n({ id: "c", type: "sst_calendar", is_read: true }),
    ]);
    expect(g.map((x) => x.group)).toEqual(["sst", "clients", "other"]);
    expect(g[0].unread).toBe(0);
    expect(g[1].unread).toBe(1);
  });
  it("donne la page cible", () => {
    expect(notificationTarget(n({ type: "sst_calendar" }))).toBe("/pilot/calendrier");
    expect(notificationTarget(n({ client_id: "c1" }))).toBe("/clients/c1");
    expect(notificationTarget(n({}))).toBeNull();
  });
});
