// Pré-devis — lecture navigateur d'un fichier catalogue : Excel fournisseurs ou export Henrri.
// Fine couche SheetJS : la logique est dans predevis-catalogue-matrix et predevis-catalogue-import.

import * as XLSX from "xlsx";
import type { RawRow } from "./predevis-catalogue-import";
import { matrixToRows, type MatrixSource } from "./predevis-catalogue-matrix";

// Onglets acceptés par source, par ordre de préférence. Pas de repli sur une autre feuille.
const SHEET_NAMES: Record<MatrixSource, string[]> = {
  excel: ["Produits", "Produit"],
  henrri: ["Référence", "Export"],
};

export class CatalogueFileError extends Error {}

export async function readCatalogueFile(file: File, source: MatrixSource): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = SHEET_NAMES[source].find((n) => wb.Sheets[n]);
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!name || !sheet) {
    throw new CatalogueFileError(
      `Onglet « ${SHEET_NAMES[source][0]} » introuvable dans ${file.name}.`,
    );
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const rows = matrixToRows(matrix, source);
  if (rows.length === 0) {
    throw new CatalogueFileError(
      `En-tête non reconnu dans l'onglet « ${name} » de ${file.name} (colonnes attendues : ${
        source === "henrri" ? "Référence, P.A HT" : "Code produit, PAU HT"
      }).`,
    );
  }
  return rows;
}
