// Pré-devis — bloc texte client d'un poste (pur).
// Liste les fournitures et leurs caractéristiques. Aucun prix d'achat, aucune marge.
// Une donnée absente est signalée, jamais inventée.
// Mise en forme : une fourniture par bloc (tiret, puis quantité indentée), blocs séparés par une ligne vide.

export type ClientBlockLine = {
  kind: "fourniture" | "mo";
  designation: string;
  clientDescription: string | null;
  quantity: number | null;
  unit: string | null;
};

const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");

export function clientBlock(lines: ClientBlockLine[]): string {
  return lines
    .filter((l) => l.kind === "fourniture")
    .map((l) => {
      const label = (l.clientDescription?.trim() || l.designation).trim();
      const unit = l.unit?.trim() || "unité à préciser";
      const qty = l.quantity == null ? "à préciser" : `${fmtQty(l.quantity)} ${unit}`;
      return `- ${label}\n  Quantité : ${qty}`;
    })
    .join("\n\n");
}
