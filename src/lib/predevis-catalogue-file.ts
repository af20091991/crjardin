// Pré-devis — lecture navigateur des fichiers catalogue (Excel « Produits » ou export Henrri).
// Fine couche SheetJS : la logique est dans predevis-catalogue-matrix et predevis-catalogue-import.

import * as XLSX from "xlsx";
import type { RawRow } from "./predevis-catalogue-import";
import { matrixToRows, type MatrixSource } from "./predevis-catalogue-matrix";

const SHEET_NAME: Record<MatrixSource, string> = {
  excel: "Produits",
  henrri: "Export",
};

export class CatalogueFileError extends Error {}

export async function readCatalogueFile(file: File, source: MatrixSource): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[SHEET_NAME[source]];
  if (!sheet) {
    throw new CatalogueFileError(`Onglet « ${SHEET_NAME[source]} » introuvable dans ${file.name}.`);
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const rows = matrixToRows(matrix, source);
  if (rows.length === 0) {
    throw new CatalogueFileError(`En-tête non reconnu dans « ${SHEET_NAME[source]} » de ${file.name}.`);
  }
  return rows;
}
