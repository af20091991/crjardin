import { describe, expect, it } from "bun:test";
import { buildClientRappelMail, splitWorks } from "@/lib/rappel-intervention-client-mail";

const base = {
  clientName: "Pouchain",
  dateLabel: "jeudi 3 décembre 2026",
  timeLabel: "7h30",
  works: ["Souffleur", "Massifs", "Taille"],
  premiumUrl: "https://pp.delagraineaujardin.com/partage/abc",
};

describe("buildClientRappelMail", () => {
  it("construit l'objet avec la date et l'heure", () => {
    expect(buildClientRappelMail(base).subject).toBe(
      "Rappel : intervention jardin le jeudi 3 décembre 2026 à 7h30",
    );
  });

  it("met le créneau en gras et souligné, avec les travaux en liste", () => {
    const { html } = buildClientRappelMail(base);
    expect(html).toContain("<strong><u>le jeudi 3 décembre 2026 à 7h30</u></strong>");
    expect(html).toContain("<li>Souffleur</li>");
    expect(html).toContain("<li>Taille</li>");
    expect(html).toContain('href="https://pp.delagraineaujardin.com/partage/abc"');
  });

  it("n'expose pas la mention « Jardinement vôtre » en double dans la signature", () => {
    const { html } = buildClientRappelMail(base);
    expect(html.split("Jardinement vôtre").length - 1).toBe(0);
  });

  it("échappe les noms saisis", () => {
    const { html } = buildClientRappelMail({ ...base, clientName: "<b>X</b>" });
    expect(html).not.toContain("<b>X</b>");
  });
});

describe("splitWorks", () => {
  it("découpe le titre du calendrier en travaux", () => {
    expect(splitWorks("Souffleur · Massifs · Taille")).toEqual(["Souffleur", "Massifs", "Taille"]);
  });
});
