import { describe, expect, it } from "bun:test";
import {
  extractWords,
  groupIssues,
  isProseField,
  maskNonProse,
  replaceIssues,
  resolveIssues,
  wordsToCheck,
} from "@/lib/spellcheck";

describe("détecteur d'orthographe — extraction", () => {
  it("extrait les mots avec leur position", () => {
    const tokens = extractWords("le jardin est beau");
    expect(tokens.map((t) => t.word)).toEqual(["le", "jardin", "est", "beau"]);
    expect(tokens[1]).toMatchObject({ start: 3, end: 9 });
  });

  it("sépare les élisions et ignore les mots d'une lettre", () => {
    expect(extractWords("l'arrosage d'été").map((t) => t.word)).toEqual(["arrosage", "été"]);
  });

  it("ignore sigles, mots collés à un chiffre, adresses web et e-mails", () => {
    const text = "SST pdf2024 voir https://exemple.fr/page ou contact@exemple.fr #tag fin";
    expect(extractWords(text).map((t) => t.word)).toEqual(["voir", "ou", "fin"]);
  });

  it("ignore les noms propres hors début de phrase mais pas au début", () => {
    const words = extractWords("Monsieur Dupont habite à Lille. Dupont arrive").map((t) => t.word);
    expect(words).toContain("Monsieur");
    expect(words).not.toContain("Lille");
    expect(words.filter((w) => w === "Dupont")).toHaveLength(1);
  });

  it("garde les mots composés avec leurs parties", () => {
    const [token] = extractWords("porte-monnaie");
    expect(token.parts).toEqual(["porte", "monnaie"]);
    expect(wordsToCheck([token]).sort()).toEqual(["monnaie", "porte", "porte-monnaie"]);
  });

  it("neutralise les zones non rédigées en conservant les positions", () => {
    const text = "voir www.site.fr ok";
    expect(maskNonProse(text)).toHaveLength(text.length);
  });
});

describe("détecteur d'orthographe — fautes", () => {
  it("signale uniquement les mots inconnus du dictionnaire", () => {
    const tokens = extractWords("le jardn est beau");
    const issues = resolveIssues(tokens, new Set(["jardn"]));
    expect(issues).toEqual([{ word: "jardn", start: 3, end: 8 }]);
  });

  it("respecte la liste d'ignorés", () => {
    const tokens = extractWords("le jardn");
    expect(resolveIssues(tokens, new Set(["jardn"]), (w) => w === "jardn")).toEqual([]);
  });

  it("accepte un mot composé inconnu dont toutes les parties sont connues", () => {
    const tokens = extractWords("va-et-vient");
    expect(resolveIssues(tokens, new Set(["va-et-vient"]))).toEqual([]);
    const tokens2 = extractWords("porte-monnaiee");
    expect(resolveIssues(tokens2, new Set(["porte-monnaiee", "monnaiee"]))).toHaveLength(1);
  });

  it("remplace toutes les occurrences d'un mot sans décaler les autres", () => {
    const text = "jardn et jardn bleu";
    const issues = resolveIssues(extractWords(text), new Set(["jardn"]));
    expect(replaceIssues(text, issues, "jardn", "jardin")).toBe("jardin et jardin bleu");
  });

  it("ne remplace pas si le texte a changé depuis la détection", () => {
    const issues = [{ word: "jardn", start: 0, end: 5 }];
    expect(replaceIssues("autre chose", issues, "jardn", "jardin")).toBe("autre chose");
  });

  it("regroupe les fautes par mot", () => {
    expect(
      groupIssues([
        { word: "a", start: 0, end: 1 },
        { word: "b", start: 2, end: 3 },
        { word: "a", start: 4, end: 5 },
      ]),
    ).toEqual([
      { word: "a", count: 2 },
      { word: "b", count: 1 },
    ]);
  });
});

describe("détecteur d'orthographe — champs concernés", () => {
  it("vérifie les textarea et champs texte libres", () => {
    expect(isProseField({ tag: "TEXTAREA", name: "notes" })).toBe(true);
    expect(isProseField({ tag: "INPUT", type: "text", name: "title" })).toBe(true);
  });

  it("exclut les champs techniques et verrouillés", () => {
    expect(isProseField({ tag: "INPUT", type: "email" })).toBe(false);
    expect(isProseField({ tag: "INPUT", type: "text", name: "client_email" })).toBe(false);
    expect(isProseField({ tag: "INPUT", type: "text", id: "siret" })).toBe(false);
    expect(isProseField({ tag: "INPUT", type: "text", autocomplete: "username" })).toBe(false);
    expect(isProseField({ tag: "TEXTAREA", readOnly: true })).toBe(false);
    expect(isProseField({ tag: "TEXTAREA", spellcheck: "false" })).toBe(false);
    expect(isProseField({ tag: "TEXTAREA", optOut: true })).toBe(false);
    expect(isProseField({ tag: "SELECT" })).toBe(false);
  });
});
