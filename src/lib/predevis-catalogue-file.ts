// Pré-devis — lecture navigateur du fichier Excel fournisseurs (onglet « Référence » ou « Produits »).
// Fine couche SheetJS : la logique est dans predevis-catalogue-matrix et predevis-catalogue-import.

import * as XLSX from "xlsx";
import type { RawRow } from "./predevis-catalogue-import";
import { matrixToRows } from "./predevis-catalogue-matrix";

// Noms d'onglet acceptés, par ordre de préférence. Sinon : la première feuille du classeur.
const SHEET_NAMES = ["Référence", "Produits", "Produit"];

export class CatalogueFileError extends Error {}

export async function readCatalogueFile(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = SHEET_NAMES.find((n) => wb.Sheets[n]) ?? wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!name || !sheet) {
    throw new CatalogueFileError(`Aucun onglet lisible dans ${file.name}.`);
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const rows = matrixToRows(matrix, "excel");
  if (rows.length === 0) {
    throw new CatalogueFileError(`En-tête non reconnu dans l'onglet « ${name} » de ${file.name}.`);
  }
  return rows;
}
