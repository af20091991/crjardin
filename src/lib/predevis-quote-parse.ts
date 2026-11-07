// Pré-devis — lecture pure d'un devis détaillé Henrri à partir de mots positionnés.
// Entrée : mots extraits du PDF (page, x, y, texte, gras). Aucune dépendance navigateur ici.
//
// Règles (validées sur le devis réel) :
// - une ligne = Référence · Désignation · Quantité · PU · TVA · Montant HT
// - « Sous Total » (HT) clôt un poste ; le texte qui précède la première ligne d'un poste
//   (après le Sous Total précédent) en est la description ; son premier bloc en gras en est le titre
// - le texte qui suit une ligne, avant la suivante, est une suite de désignation (flag `continued`)
// - le texte après le dernier Sous Total, sans ligne ensuite, est « hors poste » (non affecté)
// - contrôle : somme des Montant HT du poste = Sous Total (tolérance 0,05 € d'arrondi)

import { parsePrice } from "./predevis-catalogue-normalize";

export type PdfWord = {
  page: number;
  x: number; // bord gauche
  x1: number; // bord droit
  y: number; // haut (croissant vers le bas)
  str: string;
  bold: boolean;
};

export type QuoteRow = {
  position: number;
  ref: string | null; // référence nettoyée (sans « (copie…) »)
  refRaw: string | null;
  designation: string;
  quantity: number | null;
  pu: number | null;
  tvaRate: number | null;
  ht: number | null;
  ttc: number | null; // HT × 1,2, arrondi au centime, par ligne
  kind: "fourniture" | "mo";
  continued: boolean; // une suite de désignation a été ajoutée
};

export type QuotePoste = {
  index: number;
  title: string | null;
  descriptionLines: string[];
  rows: QuoteRow[];
  subtotalHt: number | null;
  sumHt: number;
  sumTtc: number;
  deltaHt: number | null;
  status: "ok" | "a_verifier";
  reasons: string[];
};

export type QuoteParse = {
  devisNumber: string | null;
  postes: QuotePoste[];
  orphanText: string[];
  totalHtDeclared: number | null;
  warnings: string[];
};

export const SUBTOTAL_TOLERANCE = 0.05;
const TVA_FACTOR = 1.2;

type Line = { page: number; y: number; words: PdfWord[] };
type Cells = { ref: string; designation: string; qty: string; pu: string; tva: string; ht: string };
type Columns = { ref: number; desig: number; qty: number; pu: number; tva: number; ht: number };

const NUMERIC_RE = /^[\d.,  ]+€?$|^€$|^%$/;
const NOISE_RE = [
  /^DEVIS N°/,
  /^Le (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) /,
  /^Page \d+ \/ \d+$/,
  /^Fait avec Henrri/,
  /^Référence Désignation/,
  /^\* Les mentions en gras/,
];
const CLAUSE_START_RE = /^CLAUSE DE RÉSERVE/;
const END_RE = /^(Bon pour Accord|Conditions de paiement)/;
const TOTAL_LINE_RE = /^(Total HT|Total TTC|TVA \()/;

function groupLines(words: PdfWord[]): Line[] {
  const sorted = [...words].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === w.page && Math.abs(last.y - w.y) <= 2) {
      last.words.push(w);
    } else {
      lines.push({ page: w.page, y: w.y, words: [w] });
    }
  }
  for (const l of lines) l.words.sort((a, b) => a.x - b.x);
  return lines;
}

function findColumns(lines: Line[]): Columns | null {
  for (const l of lines) {
    const text = l.words.map((w) => w.str);
    if (!text.includes("Référence") || !text.includes("Désignation")) continue;
    const at = (s: string) => l.words.find((w) => w.str === s)?.x;
    const ref = at("Référence");
    const desig = at("Désignation");
    const qty = at("Quantité");
    const pu = at("PU");
    const tva = at("TVA");
    const ht = at("Montant");
    if ([ref, desig, qty, pu, tva, ht].some((v) => v === undefined)) continue;
    return { ref: ref!, desig: desig!, qty: qty!, pu: pu!, tva: tva!, ht: ht! };
  }
  return null;
}

/** Affecte chaque mot à une colonne : numérique par centre, texte par bord gauche. */
function splitCells(line: Line, cols: Columns): Cells {
  const cells: Cells = { ref: "", designation: "", qty: "", pu: "", tva: "", ht: "" };
  for (const w of line.words) {
    const center = (w.x + w.x1) / 2;
    if (NUMERIC_RE.test(w.str) && center >= cols.qty) {
      const key = center < cols.pu ? "qty" : center < cols.tva ? "pu" : center < cols.ht ? "tva" : "ht";
      cells[key] = [cells[key], w.str].filter(Boolean).join(" ");
    } else if (w.x < cols.desig - 2) {
      cells.ref = [cells.ref, w.str].filter(Boolean).join(" ");
    } else {
      cells.designation = [cells.designation, w.str].filter(Boolean).join(" ");
    }
  }
  return cells;
}

function num(s: string): number | null {
  if (!s) return null;
  const p = parsePrice(s);
  return p.value;
}

export function cleanReference(raw: string): string | null {
  const cleaned = raw
    .replace(/\s*\(copie[^)]*\)?.*$/i, "")
    .replace(/…/g, "")
    .trim();
  return cleaned.replace(/\s*\(\d+\)$/, "").trim() || null;
}

function isMo(ref: string | null, designation: string): boolean {
  return /^MO\d*$/i.test(ref ?? "") || /^main[- ]?d[' ]?oeuvre/i.test(designation.trim());
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseQuote(words: PdfWord[]): QuoteParse {
  const firstLines = groupLines(words);
  const cols = findColumns(firstLines);
  const warnings: string[] = [];
  if (!cols) {
    return { devisNumber: null, postes: [], orphanText: [], totalHtDeclared: null, warnings: ["En-tête du tableau introuvable."] };
  }
  // Tout ce qui est au-dessus du premier en-tête (page 1) : coordonnées de l'émetteur et du client. Ignoré.
  const headerY = firstLines.find((l) => l.words.some((w) => w.str === "Référence") && l.words.some((w) => w.str === "Désignation"))?.y ?? 0;
  const lines = groupLines(words.filter((w) => !(w.page === 1 && w.y < headerY - 2)));

  const fullText = firstLines.map((l) => l.words.map((w) => w.str).join(" ")).join("\n");
  const devisNumber = fullText.match(/DEVIS N° (\S+)/)?.[1] ?? null;
  const totalHtDeclared = num(fullText.match(/Total HT\s+([\d\s.,]+€)/)?.[1] ?? "");

  const postes: QuotePoste[] = [];
  let pending: string[] = [];
  let pendingBold: string[] = [];
  let titleDone = false;
  let lastWasBold = false;
  let current: QuotePoste | null = null;
  let lastRow: QuoteRow | null = null;
  let inClause = false;
  let position = 0;
  let stop = false;

  const openPoste = () => {
    const title = pendingBold.length > 0 ? pendingBold.join(" ") : null;
    current = {
      index: postes.length + 1,
      title,
      descriptionLines: [...pending],
      rows: [],
      subtotalHt: null,
      sumHt: 0,
      sumTtc: 0,
      deltaHt: null,
      status: "ok",
      reasons: [],
    };
    postes.push(current);
    pending = [];
    pendingBold = [];
    titleDone = false;
    lastWasBold = false;
  };

  for (const line of lines) {
    if (stop) break;
    const lineText = line.words.map((w) => w.str).join(" ");
    const cells = splitCells(line, cols);

    if (END_RE.test(lineText)) { stop = true; break; }
    if (CLAUSE_START_RE.test(lineText)) { inClause = true; continue; }
    if (inClause) {
      if (/^Fait avec Henrri/.test(lineText)) inClause = false;
      continue;
    }
    if (NOISE_RE.some((re) => re.test(lineText))) continue;
    if (TOTAL_LINE_RE.test(lineText)) continue;

    const isSubtotal = /^Sous Total/.test(cells.designation) && cells.ht !== "";
    if (isSubtotal) {
      if (!current) {
        warnings.push(`Sous Total sans ligne avant (page ${line.page}).`);
        continue;
      }
      const poste: QuotePoste = current;
      poste.subtotalHt = num(cells.ht);
      poste.sumHt = roundCents(poste.rows.reduce((s, r) => s + (r.ht ?? 0), 0));
      poste.sumTtc = roundCents(poste.rows.reduce((s, r) => s + (r.ttc ?? 0), 0));
      if (poste.subtotalHt != null) {
        poste.deltaHt = roundCents(poste.sumHt - poste.subtotalHt);
        if (Math.abs(poste.deltaHt) > SUBTOTAL_TOLERANCE) {
          poste.status = "a_verifier";
          poste.reasons.push(`Écart de ${poste.deltaHt.toFixed(2)} € avec le Sous Total.`);
        }
      } else {
        poste.status = "a_verifier";
        poste.reasons.push("Sous Total illisible.");
      }
      if (poste.rows.length === 0) {
        poste.status = "a_verifier";
        poste.reasons.push("Aucune ligne dans ce poste.");
      }
      current = null;
      lastRow = null;
      pending = [];
      pendingBold = [];
      titleDone = false;
      lastWasBold = false;
      continue;
    }

    const isRow =
      cells.qty !== "" && cells.pu !== "" && cells.tva !== "" && cells.ht !== "" && cells.designation !== "";
    if (isRow) {
      if (!current) openPoste();
      const poste: QuotePoste = current!;
      const ht = num(cells.ht);
      const refRaw = cells.ref || null;
      const ref = refRaw ? cleanReference(refRaw) : null;
      const row: QuoteRow = {
        position: ++position,
        ref,
        refRaw,
        designation: cells.designation,
        quantity: num(cells.qty),
        pu: num(cells.pu),
        tvaRate: num(cells.tva),
        ht,
        ttc: ht == null ? null : roundCents(ht * TVA_FACTOR),
        kind: isMo(ref, cells.designation) ? "mo" : "fourniture",
        continued: false,
      };
      poste.rows.push(row);
      lastRow = row;
      continue;
    }

    // Texte sans montant
    const text = [cells.ref, cells.designation].filter(Boolean).join(" ").trim();
    if (!text) continue;
    if (lastRow) {
      lastRow.designation = `${lastRow.designation} ${text}`.trim();
      lastRow.continued = true;
      continue;
    }
    pending.push(text);
    const isBold = line.words.every((w) => w.bold);
    if (isBold && !titleDone) {
      pendingBold.push(text);
      lastWasBold = true;
    } else {
      if (pendingBold.length > 0) titleDone = true;
      lastWasBold = false;
    }
  }

  // Fin : poste resté ouvert sans Sous Total
  if (current) {
    const poste: QuotePoste = current;
    poste.status = "a_verifier";
    poste.reasons.push("Pas de Sous Total pour ce poste.");
    poste.sumHt = roundCents(poste.rows.reduce((s, r) => s + (r.ht ?? 0), 0));
    poste.sumTtc = roundCents(poste.rows.reduce((s, r) => s + (r.ttc ?? 0), 0));
  }

  const orphanText = pending.filter((t) => t.length > 0);
  if (orphanText.length > 0) warnings.push("Texte hors poste : non affecté, à vérifier.");

  // Contrôle global : somme des postes contre le total HT déclaré
  if (totalHtDeclared != null) {
    const sum = roundCents(postes.reduce((s, p) => s + p.sumHt, 0));
    if (Math.abs(sum - totalHtDeclared) > SUBTOTAL_TOLERANCE) {
      warnings.push(`Total des postes ${sum.toFixed(2)} € ≠ Total HT déclaré ${totalHtDeclared.toFixed(2)} €.`);
    }
  }

  return { devisNumber, postes, orphanText, totalHtDeclared, warnings };
}
