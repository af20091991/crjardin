import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  canSendReport,
  reportIdempotencyKey,
  reportSendStatus,
  reportShareUrl,
  sendReportToRecipients,
  resumeReportLogging,
  type ReportSendContext,
} from "@/lib/report-send";

const base: ReportSendContext = {
  done: true,
  pdfStoragePath: "u1/iv1/2026-08-16.pdf",
  shareToken: "tok",
  recipients: ["a@x.fr"],
  sentToClientAt: null,
  clientReadAt: null,
};

describe("états d'envoi du compte-rendu", () => {
  test("blocages explicites et ordonnés", () => {
    expect(reportSendStatus({ ...base, done: false })).toBe("brouillon");
    expect(reportSendStatus({ ...base, pdfStoragePath: null })).toBe("archive_indisponible");
    expect(reportSendStatus({ ...base, recipients: [] })).toBe("aucun_destinataire");
    expect(reportSendStatus({ ...base, shareToken: null })).toBe("lien_invalide");
    expect(canSendReport({ ...base, pdfStoragePath: null })).toBe(false);
  });

  test("prêt, en cours, envoyé puis consulté", () => {
    expect(reportSendStatus(base)).toBe("pret");
    expect(reportSendStatus({ ...base, sending: true })).toBe("envoi_en_cours");
    expect(reportSendStatus({ ...base, sentToClientAt: "2026-08-16T10:00:00Z" })).toBe("envoye");
    expect(
      reportSendStatus({ ...base, sentToClientAt: "2026-08-16T10:00:00Z", clientReadAt: "2026-08-17T09:00:00Z" }),
    ).toBe("consulte");
  });

  test("journalisation échouée : état de reprise, pas un échec d'envoi", () => {
    expect(
      reportSendStatus({ ...base, lastOutcome: { sent: [], logPending: ["a@x.fr"], failed: [] } }),
    ).toBe("reprise_journalisation");
    expect(
      reportSendStatus({ ...base, lastOutcome: { sent: [], logPending: [], failed: [{ recipient: "a@x.fr", message: "ko" }] } }),
    ).toBe("echec");
  });

  test("lien de partage ciblé sur le compte-rendu", () => {
    expect(reportShareUrl("https://app.fr", "tok", "iv1")).toBe(
      "https://app.fr/partage/tok?intervention=iv1",
    );
  });

  test("clé d'idempotence stable par archive, changeante après nouvelle archive", () => {
    const k1 = reportIdempotencyKey("iv1", "A@x.fr", "u1/iv1/v1.pdf");
    expect(k1).toBe(reportIdempotencyKey("iv1", "a@x.fr", "u1/iv1/v1.pdf"));
    expect(k1).not.toBe(reportIdempotencyKey("iv1", "a@x.fr", "u1/iv1/v2.pdf"));
  });
});

describe("boucle multi-destinataires reprenable", () => {
  test("un échec d'envoi n'empêche pas les autres et reste reprenable", async () => {
    const calls: string[] = [];
    const out = await sendReportToRecipients(
      {
        sendEmail: async (r) => {
          calls.push(r);
          if (r === "b@x.fr") throw new Error("file indisponible");
        },
        logSent: async () => {},
        markSent: async () => {},
      },
      { interventionId: "iv1", pdfStoragePath: "p.pdf", recipients: ["a@x.fr", "b@x.fr", "c@x.fr"] },
    );
    expect(calls).toEqual(["a@x.fr", "b@x.fr", "c@x.fr"]);
    expect(out.sent).toEqual(["a@x.fr", "c@x.fr"]);
    expect(out.failed.map((f) => f.recipient)).toEqual(["b@x.fr"]);
  });

  test("e-mail accepté + journalisation en échec : aucun renvoi, reprise signalée", async () => {
    let sends = 0;
    const out = await sendReportToRecipients(
      {
        sendEmail: async () => { sends += 1; },
        logSent: async () => { throw new Error("journal indisponible"); },
        markSent: async () => {},
      },
      { interventionId: "iv1", pdfStoragePath: "p.pdf", recipients: ["a@x.fr"] },
    );
    expect(sends).toBe(1);
    expect(out.sent).toEqual([]);
    expect(out.logPending).toEqual(["a@x.fr"]);
    expect(out.failed).toEqual([]);
  });

  test("reprise : les destinataires déjà acceptés ne sont pas renvoyés", async () => {
    const calls: string[] = [];
    const out = await sendReportToRecipients(
      {
        sendEmail: async (r) => { calls.push(r); },
        logSent: async () => {},
        markSent: async () => {},
      },
      {
        interventionId: "iv1",
        pdfStoragePath: "p.pdf",
        recipients: ["a@x.fr", "b@x.fr"],
        alreadySent: ["A@x.fr"],
      },
    );
    expect(calls).toEqual(["b@x.fr"]);
    expect(out.sent).toEqual(["b@x.fr"]);
  });

  test("aucun destinataire à traiter : aucun marquage d'envoi", async () => {
    let marked = 0;
    const out = await sendReportToRecipients(
      {
        sendEmail: async () => {},
        logSent: async () => {},
        markSent: async () => { marked += 1; },
      },
      { interventionId: "iv1", pdfStoragePath: "p.pdf", recipients: ["a@x.fr"], alreadySent: ["a@x.fr"] },
    );
    expect(marked).toBe(0);
    expect(out.sent).toEqual([]);
  });
});

describe("reprise : rejouer le journal sans jamais renvoyer d'e-mail", () => {
  test("journalisation rejouée avec succès et marquage effectué", async () => {
    let marked = 0;
    const logged: string[] = [];
    const out = await resumeReportLogging(
      { logSent: async (r) => { logged.push(r); }, markSent: async () => { marked += 1; } },
      { recipients: ["a@x.fr", "b@x.fr"] },
    );
    expect(logged).toEqual(["a@x.fr", "b@x.fr"]);
    expect(marked).toBe(1);
    expect(out).toEqual({ sent: ["a@x.fr", "b@x.fr"], logPending: [], failed: [] });
  });

  test("journal encore indisponible : reprise toujours signalée, aucun échec d'envoi", async () => {
    const out = await resumeReportLogging(
      { logSent: async () => { throw new Error("journal ko"); }, markSent: async () => {} },
      { recipients: ["a@x.fr"] },
    );
    expect(out.logPending).toEqual(["a@x.fr"]);
    expect(out.sent).toEqual([]);
    expect(out.failed).toEqual([]);
  });

  test("marquage d'envoi en échec : tout reste à reprendre", async () => {
    const out = await resumeReportLogging(
      { logSent: async () => {}, markSent: async () => { throw new Error("update ko"); } },
      { recipients: ["a@x.fr", "b@x.fr"] },
    );
    expect(out.sent).toEqual([]);
    expect(out.logPending).toEqual(["a@x.fr", "b@x.fr"]);
  });

  test("rien à reprendre : aucun marquage", async () => {
    let marked = 0;
    const out = await resumeReportLogging(
      { logSent: async () => {}, markSent: async () => { marked += 1; } },
      { recipients: [] },
    );
    expect(marked).toBe(0);
    expect(out.sent).toEqual([]);
  });
});

describe("notifyClient : un seul chemin de reprise", () => {
  test("la route utilise resumeReportLogging et n'envoie pas en reprise", () => {
    const src = readFileSync("src/routes/_authenticated/interventions.$interventionId.tsx", "utf8");
    expect(src).toContain("resumeReportLogging");
    // Le chemin de reprise court-circuite l'envoi.
    const resumeIdx = src.indexOf("resumeReportLogging({ logSent, markSent }");
    const sendIdx = src.indexOf("sendReportToRecipients(");
    expect(resumeIdx).toBeGreaterThan(0);
    expect(resumeIdx).toBeLessThan(sendIdx);
    // Pas de seconde implémentation locale de la reprise.
    expect(src).not.toContain("alreadySent:");
  });
});

describe("clé d'idempotence — renvoi volontaire", () => {
  it("réutilise la même clé pour tous les destinataires d'une même tentative", () => {
    const a = reportIdempotencyKey("iv1", "a@x.fr", "path/x.pdf", "att1");
    const b = reportIdempotencyKey("iv1", "a@x.fr", "path/x.pdf", "att1");
    expect(a).toBe(b);
  });

  it("produit une clé différente à chaque nouvelle tentative", () => {
    const a = reportIdempotencyKey("iv1", "a@x.fr", "path/x.pdf", "att1");
    const b = reportIdempotencyKey("iv1", "a@x.fr", "path/x.pdf", "att2");
    expect(a).not.toBe(b);
  });

  it("un second envoi de la même archive ne réutilise pas la clé précédente", async () => {
    const keys: string[] = [];
    const deps = {
      sendEmail: async (_r: string, k: string) => { keys.push(k); },
      logSent: async () => {},
      markSent: async () => {},
    };
    const params = { interventionId: "iv1", pdfStoragePath: "p/x.pdf", recipients: ["a@x.fr"] };
    await sendReportToRecipients(deps, params);
    await sendReportToRecipients(deps, params);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
