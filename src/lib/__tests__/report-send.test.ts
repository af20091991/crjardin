import { describe, expect, test } from "bun:test";
import {
  canSendReport,
  reportIdempotencyKey,
  reportSendStatus,
  reportShareUrl,
  sendReportToRecipients,
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
