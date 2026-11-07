// Pré-devis — repérage du gras à partir des polices d'une page (pur).
// 1) Si le nom de police est lisible (ex. NunitoBold), il fait foi.
// 2) Sinon, sur un document à deux graisses, la police la plus large par caractère est la grasse.
//    Si l'écart est trop faible, aucune police n'est marquée grasse : pas de titre détecté, jamais inventé.
const BOLD_RE = /bold|black|semibold|demi/i;
const MIN_WEIGHT_RATIO = 1.04;

export type FontSample = {
  fontName: string;
  family: string;
  /** Somme des largeurs (en em) des fragments de cette police. */
  em: number;
  /** Nombre de caractères de cette police. */
  chars: number;
};

export function boldFonts(samples: FontSample[]): Set<string> {
  const named = samples
    .filter((s) => BOLD_RE.test(s.family) || BOLD_RE.test(s.fontName))
    .map((s) => s.fontName);
  if (named.length > 0) return new Set(named);

  const measured = samples
    .filter((s) => s.chars > 0)
    .map((s) => ({ fontName: s.fontName, avg: s.em / s.chars }));
  if (measured.length < 2) return new Set();
  const heaviest = measured.reduce((a, b) => (b.avg > a.avg ? b : a));
  const lightest = measured.reduce((a, b) => (b.avg < a.avg ? b : a));
  if (heaviest.avg / lightest.avg < MIN_WEIGHT_RATIO) return new Set();
  return new Set([heaviest.fontName]);
}
