import { describe, expect, it } from "bun:test";
import { buildRappelMail } from "@/lib/rappel-intervention-mail";

describe("buildRappelMail", () => {
  const base = {
    clientName: "Mme Dupont",
    dateLabel: "mercredi 13 novembre 2026",
    confirmUrl: "https://example.test/rappel/confirmer?t=abc",
  };

  it("place la date dans l'objet et le corps", () => {
    const m = buildRappelMail(base);
    expect(m.subject).toContain("13 novembre 2026");
    expect(m.text).toContain("Bonjour Mme Dupont,");
    expect(m.text).toContain(base.confirmUrl);
  });

  it("ajoute l'heure quand elle est fournie", () => {
    const m = buildRappelMail({ ...base, timeLabel: "9 h 00" });
    expect(m.text).toContain("le mercredi 13 novembre 2026 à 9 h 00");
  });

  it("échappe le HTML du nom client", () => {
    const m = buildRappelMail({ ...base, clientName: "<script>x</script>" });
    expect(m.html).not.toContain("<script>x</script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});
