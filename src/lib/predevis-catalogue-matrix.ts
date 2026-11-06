// Pré-devis — repérage de l'en-tête dans une feuille lue en matrice (pur, sans dépendance).
// Les fichiers réels ont des lignes de titre avant l'en-tête : on cherche la ligne d'en-tête.

import { normText } from "./predevis-catalogue-normalize";
import type { RawRow } from "./predevis-catalogue-import";

export type MatrixSource = "excel" | "henrri";

const CODE_HEADER: Record<MatrixSource, string> = {
  excel: "Code produit",
  henrri: "Référence",
};
const PRICE_HEADER: Record<MatrixSource, string> = {
  excel: "PAU HT",
  henrri: "P.A HT",
};

/**
 * Transforme une matrice (tableau de lignes) en objets clés = libellés d'en-tête.
 * - Excel « Produits » : la désignation est dans la colonne située à gauche du code (titre de section).
 * - Retourne [] si aucun en-tête reconnaissable n'est trouvé (fichier non conforme).
 */
export function matrixToRows(matrix: unknown[][], source: MatrixSource): RawRow[] {
  const codeLabel = normText(CODE_HEADER[source]);
  const priceLabel = normText(PRICE_HEADER[source]);

  const headerIndex = matrix.findIndex(
    (row) =>
      row.some((c) => normText(String(c ?? "")) === codeLabel) &&
      row.some((c) => normText(String(c ?? "")) === priceLabel),
  );
  if (headerIndex < 0) return [];

  const headers: string[] = (matrix[headerIndex] ?? []).map((c) => String(c ?? "").trim());
  const codeCol = headers.findIndex((h) => normText(h) === codeLabel);
  if (source === "excel" && codeCol > 0) {
    headers[codeCol - 1] = "Désignation";
  }

  const rows: RawRow[] = [];
  for (const line of matrix.slice(headerIndex + 1)) {
    const obj: RawRow = {};
    let any = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const value = line[i];
      if (value !== undefined && value !== null && String(value).trim() !== "") any = true;
      obj[h] = value ?? "";
    });
    if (any) rows.push(obj);
  }
  return rows;
}
