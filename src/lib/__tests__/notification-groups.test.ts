import { describe, expect, it } from "bun:test";
import { groupNotifications, notificationTarget } from "@/lib/notification-groups";
import { notificationUrl } from "@/lib/push-fcm.server";
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

describe("notificationTarget par rôle", () => {
  it("le prestataire n'est pas envoyé vers une fiche client", () => {
    expect(notificationTarget(n({ client_id: "c1" }), "prestataire")).toBeNull();
  });
  it("le prestataire garde le calendrier SST et le CR chantier", () => {
    expect(notificationTarget(n({ type: "sst_calendar" }), "prestataire")).toBe(
      "/pilot/calendrier",
    );
    expect(notificationTarget(n({ intervention_id: "i1" }), "prestataire")).toBe(
      "/interventions/i1",
    );
  });
});

describe("cible de chaque notification (cloche et push)", () => {
  it("mise à jour de l'appli -> Personnalisation", () => {
    expect(notificationTarget(n({ type: "app_update" }))).toBe("/personnalisation");
    expect(notificationUrl({ type: "app_update", client_id: null, intervention_id: null })).toBe(
      "/personnalisation",
    );
  });
  it("alerte Radar -> Site web", () => {
    expect(notificationTarget(n({ type: "system_alert" }))).toBe("/pilot/site-web");
  });
  it("intervention -> fiche intervention, y compris en push", () => {
    expect(notificationUrl({ type: "info", client_id: null, intervention_id: "i1" })).toBe(
      "/interventions/i1",
    );
  });
  it("SST -> calendrier, client -> fiche client, en push comme en cloche", () => {
    expect(notificationUrl({ type: "sst_worksite", client_id: null, intervention_id: null })).toBe(
      "/pilot/calendrier",
    );
    expect(notificationUrl({ type: "read", client_id: "c1", intervention_id: null })).toBe(
      "/clients/c1",
    );
  });
  it("message du client -> onglet Messages du client", () => {
    expect(notificationTarget(n({ type: "question", client_id: "c1" }))).toBe(
      "/clients/dashboard/c1?tab=messages",
    );
    expect(notificationTarget(n({ type: "annotation", client_id: "c1" }))).toBe(
      "/clients/dashboard/c1?tab=messages",
    );
    expect(notificationUrl({ type: "question", client_id: "c1", intervention_id: null })).toBe(
      "/clients/dashboard/c1?tab=messages",
    );
  });
  it("message lié à une intervention -> compte-rendu", () => {
    expect(
      notificationTarget(n({ type: "question", client_id: "c1", intervention_id: "i1" })),
    ).toBe("/interventions/i1");
  });
  it("intérêt pour une préconisation -> onglet Préconisations du tableau de bord", () => {
    expect(
      notificationTarget(
        n({
          type: "question",
          client_id: "c1",
          title: "Client X est intéressé(e) par une préconisation",
        }),
      ),
    ).toBe("/clients/dashboard/c1?tab=gestion&sub=reco");
  });
  it("demande d'inscription -> administration des comptes", () => {
    expect(
      notificationTarget(n({ type: "question", title: "Nouvelle inscription à valider" })),
    ).toBe("/admin");
  });
});
