/**
 * Détecteur d'orthographe — logique pure (sans navigateur ni dictionnaire).
 * Le dictionnaire (Hunspell français) tourne dans un worker : voir spellcheck-client.ts.
 */

export interface SpellToken {
  word: string;
  start: number;
  end: number;
  /** Parties d'un mot composé (« porte-monnaie »), vérifiées si le mot entier est inconnu. */
  parts: string[];
}

export interface SpellIssue {
  word: string;
  start: number;
  end: number;
}

const WORD_RE = /\p{L}+(?:-\p{L}+)*/gu;
// Zones qui ne sont pas du texte rédigé : adresses web, e-mails, #mots-clics, @mentions.
const MASK_RE = /(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+|[#@]\S+/giu;
const SENTENCE_END_RE = /[.!?:;\n\r…]/;

/** Remplace par des espaces (même longueur) les zones à ne pas vérifier. */
export function maskNonProse(text: string): string {
  return text.replace(MASK_RE, (match) => " ".repeat(match.length));
}

function isAllCaps(word: string): boolean {
  return word.length >= 2 && word === word.toUpperCase() && word !== word.toLowerCase();
}

function startsWithUpper(word: string): boolean {
  const first = word.charAt(0);
  return first !== first.toLowerCase() && first === first.toUpperCase();
}

function atSentenceStart(text: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text.charAt(i);
    if (
      /\s/.test(ch) ||
      ch === "-" ||
      ch === "•" ||
      ch === "*" ||
      ch === "(" ||
      ch === '"' ||
      ch === "«"
    ) {
      if (ch === "\n" || ch === "\r") return true;
      continue;
    }
    return SENTENCE_END_RE.test(ch);
  }
  return true;
}

/**
 * Extrait les mots à vérifier. Sont ignorés : mots d'une lettre, sigles (SST, PDF),
 * mots accolés à un chiffre ou « _ », mots mélangeant majuscules internes (nomPropre technique)
 * et noms propres probables (majuscule initiale hors début de phrase) — très fréquents
 * dans un CRM (clients, lieux) et source de fausses alertes.
 */
export function extractWords(text: string): SpellToken[] {
  const masked = maskNonProse(text);
  const tokens: SpellToken[] = [];
  for (const match of masked.matchAll(WORD_RE)) {
    const word = match[0];
    const start = match.index ?? 0;
    const end = start + word.length;
    if (word.replace(/-/g, "").length < 2) continue;
    if (/[\p{N}_]/u.test(masked.charAt(start - 1)) || /[\p{N}_]/u.test(masked.charAt(end)))
      continue;
    if (isAllCaps(word)) continue;
    if (/\p{Ll}\p{Lu}/u.test(word)) continue;
    if (startsWithUpper(word) && !atSentenceStart(masked, start)) continue;
    tokens.push({ word, start, end, parts: word.includes("-") ? word.split("-") : [] });
  }
  return tokens;
}

/** Mots (et parties de mots composés) à soumettre au dictionnaire, sans doublon. */
export function wordsToCheck(tokens: SpellToken[]): string[] {
  const set = new Set<string>();
  for (const token of tokens) {
    set.add(token.word);
    for (const part of token.parts) if (part.length >= 2) set.add(part);
  }
  return [...set];
}

/**
 * Croise les mots avec l'ensemble des mots inconnus du dictionnaire.
 * Un mot composé inconnu est accepté si toutes ses parties (≥ 2 lettres) sont connues.
 */
export function resolveIssues(
  tokens: SpellToken[],
  bad: ReadonlySet<string>,
  isIgnored: (word: string) => boolean = () => false,
): SpellIssue[] {
  const issues: SpellIssue[] = [];
  for (const token of tokens) {
    if (!bad.has(token.word)) continue;
    if (isIgnored(token.word)) continue;
    if (token.parts.length > 0) {
      const wrongParts = token.parts.filter((part) => part.length >= 2 && bad.has(part));
      if (wrongParts.length === 0) continue;
    }
    issues.push({ word: token.word, start: token.start, end: token.end });
  }
  return issues;
}

/** Remplace toutes les occurrences signalées d'un mot (de la fin vers le début). */
export function replaceIssues(
  text: string,
  issues: SpellIssue[],
  word: string,
  replacement: string,
): string {
  let result = text;
  const targets = issues.filter((issue) => issue.word === word).sort((a, b) => b.start - a.start);
  for (const issue of targets) {
    if (result.slice(issue.start, issue.end) !== word) continue;
    result = result.slice(0, issue.start) + replacement + result.slice(issue.end);
  }
  return result;
}

/** Regroupe les fautes par mot (ordre d'apparition) avec leur nombre d'occurrences. */
export function groupIssues(issues: SpellIssue[]): { word: string; count: number }[] {
  const map = new Map<string, number>();
  for (const issue of issues) map.set(issue.word, (map.get(issue.word) ?? 0) + 1);
  return [...map.entries()].map(([word, count]) => ({ word, count }));
}

// Mots entiers (id/name découpés en mots, camelCase compris) qui désignent un champ technique.
// Comparaison exacte : « relation » ou « hotel » ne sont plus exclus par erreur.
const SKIP_FIELD_WORDS = new Set([
  "email",
  "mail",
  "courriel",
  "phone",
  "tel",
  "telephone",
  "mobile",
  "fax",
  "url",
  "uri",
  "website",
  "siret",
  "siren",
  "iban",
  "bic",
  "code",
  "password",
  "passwd",
  "token",
  "slug",
  "zip",
  "postal",
  "cp",
  "search",
  "recherche",
  "login",
  "username",
  "identifiant",
  "lat",
  "lng",
  "lon",
  "latitude",
  "longitude",
  "ref",
  "reference",
]);

function fieldWords(label: string): string[] {
  return label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** Un champ est-il du texte rédigé ? Les champs techniques (e-mail, code, URL…) sont exclus. */
export function isProseField(attrs: {
  tag: string;
  type?: string | null;
  id?: string | null;
  name?: string | null;
  autocomplete?: string | null;
  spellcheck?: string | null;
  readOnly?: boolean;
  disabled?: boolean;
  optOut?: boolean;
  /** Champ de recherche / liste déroulante filtrante (role=combobox, cmdk…). */
  searchLike?: boolean;
}): boolean {
  if (attrs.optOut || attrs.readOnly || attrs.disabled || attrs.searchLike) return false;
  if (attrs.spellcheck === "false") return false;
  const tag = attrs.tag.toLowerCase();
  if (tag === "input") {
    const type = (attrs.type ?? "text").toLowerCase();
    if (type !== "text" && type !== "") return false;
  } else if (tag !== "textarea") {
    return false;
  }
  if (
    attrs.autocomplete &&
    /email|tel|url|username|password|postal|cc-|one-time/i.test(attrs.autocomplete)
  )
    return false;
  return !fieldWords(`${attrs.id ?? ""} ${attrs.name ?? ""}`).some((word) =>
    SKIP_FIELD_WORDS.has(word),
  );
}
