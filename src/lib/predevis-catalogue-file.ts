// Pré-devis — lecture navigateur du fichier Excel fournisseurs (onglet « Produits »).
// Fine couche SheetJS : la logique est dans predevis-catalogue-matrix et predevis-catalogue-import.

import * as XLSX from "xlsx";
import type { RawRow } from "./predevis-catalogue-import";
import { matrixToRows } from "./predevis-catalogue-matrix";

const SHEET_NAME = "Produits";

export class CatalogueFileError extends Error {}

export async function readCatalogueFile(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new CatalogueFileError(`Onglet « ${SHEET_NAME} » introuvable dans ${file.name}.`);
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const rows = matrixToRows(matrix, "excel");
  if (rows.length === 0) {
    throw new CatalogueFileError(`En-tête non reconnu dans « ${SHEET_NAME} » de ${file.name}.`);
  }
  return rows;
}
