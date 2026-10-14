// Assistant AP — export de la liste des fournitures d'un chantier à destination d'un fournisseur.
// Logique pure (groupement + texte) ; le PDF est généré à la demande avec jsPDF.
import type { ApSupply, ApWorksite } from "@/lib/assistant-ap";

export interface ApOrderLine {
  item: string;
  quantity: string;
  delivery: boolean;
  /** Date souhaitée aaaa-mm-jj : livraison, ou retrait si le mode est « retrait ». */
  date: string | null;
}

export interface ApSupplierOrder {
  supplier: string;
  lines: ApOrderLine[];
}

const NO_SUPPLIER = "Fournisseur non renseigné";

export function frLongDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

/** Fournitures à commander par défaut : tout sauf ce qui vient du stock ou est déjà OK. */
export function isOrderable(supply: Pick<ApSupply, "mode" | "status">): boolean {
  return supply.mode !== "stock" && supply.status !== "ok";
}

/** Regroupe les fournitures choisies par fournisseur (ordre alphabétique). */
export function groupSuppliesBySupplier(supplies: ApSupply[]): ApSupplierOrder[] {
  const map = new Map<string, ApSupplierOrder>();
  for (const supply of supplies) {
    const supplier = supply.supplier.trim() || NO_SUPPLIER;
    const key = supplier.toLocaleLowerCase("fr-FR");
    const order = map.get(key) ?? { supplier, lines: [] };
    order.lines.push({
      item: supply.item.trim(),
      quantity: supply.quantity?.trim() || "—",
      delivery: supply.mode === "livraison",
      date: supply.mode === "stock" ? null : supply.fulfillment_date,
    });
    map.set(key, order);
  }
  return [...map.values()].sort((a, b) => a.supplier.localeCompare(b.supplier, "fr-FR"));
}

export function worksiteDateText(worksite: Pick<ApWorksite, "scheduled_date" | "date_label">) {
  return worksite.scheduled_date
    ? frLongDate(worksite.scheduled_date)
    : worksite.date_label?.trim() || "À préciser";
}

function lineDateText(line: ApOrderLine): string {
  if (!line.date) return "—";
  return line.delivery ? frLongDate(line.date) : `${frLongDate(line.date)} (retrait)`;
}

/** Texte prêt à copier / coller dans un e-mail ou un SMS. */
export function buildOrderText(
  worksite: Pick<ApWorksite, "scheduled_date" | "date_label">,
  orders: ApSupplierOrder[],
): string {
  const chantier = worksiteDateText(worksite);
  return orders
    .map((order) =>
      [
        `Fournisseur : ${order.supplier}`,
        `Date prévue du chantier : ${chantier}`,
        "",
        "Articles :",
        ...order.lines.map(
          (line) =>
            `- ${line.item} — Quantité : ${line.quantity} — Livraison : ${
              line.delivery ? "oui" : "non"
            } — Date de livraison souhaitée : ${lineDateText(line)}`,
        ),
      ].join("\n"),
    )
    .join("\n\n----------\n\n");
}

const GREEN: [number, number, number] = [79, 142, 51];
const DARK: [number, number, number] = [48, 55, 45];
const MUTED: [number, number, number] = [112, 116, 106];
const LINE: [number, number, number] = [221, 226, 215];

/** Génère et télécharge le PDF (une section par fournisseur, une page par fournisseur). */
export async function exportOrderPdf(
  worksite: Pick<ApWorksite, "scheduled_date" | "date_label">,
  orders: ApSupplierOrder[],
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const chantier = worksiteDateText(worksite);
  // Colonnes : article, quantité, livraison, date souhaitée.
  const cols = [margin, margin + 78, margin + 112, margin + 134];
  const widths = [74, 30, 20, pageW - margin - cols[3]];

  orders.forEach((order, index) => {
    if (index > 0) doc.addPage();
    let y = margin;

    doc
      .setFont("helvetica", "bold")
      .setFontSize(18)
      .setTextColor(...GREEN);
    doc.text("Commande de fournitures", margin, y + 6);
    y += 16;

    doc.setFontSize(11).setTextColor(...DARK);
    doc.setFont("helvetica", "bold").text("Fournisseur :", margin, y);
    doc.setFont("helvetica", "normal").text(order.supplier, margin + 30, y);
    y += 6;
    doc.setFont("helvetica", "bold").text("Date prévue du chantier :", margin, y);
    doc.setFont("helvetica", "normal").text(chantier, margin + 52, y);
    y += 10;

    const header = () => {
      doc
        .setFont("helvetica", "bold")
        .setFontSize(9)
        .setTextColor(...MUTED);
      ["Article", "Quantité", "Livraison", "Date souhaitée"].forEach((label, i) =>
        doc.text(label, cols[i], y),
      );
      y += 2;
      doc.setDrawColor(...LINE).line(margin, y, pageW - margin, y);
      y += 5;
    };
    header();

    doc
      .setFont("helvetica", "normal")
      .setFontSize(10)
      .setTextColor(...DARK);
    for (const line of order.lines) {
      const cells = [
        doc.splitTextToSize(line.item, widths[0]) as string[],
        doc.splitTextToSize(line.quantity, widths[1]) as string[],
        [line.delivery ? "Oui" : "Non"],
        doc.splitTextToSize(lineDateText(line), widths[3]) as string[],
      ];
      const rows = Math.max(...cells.map((c) => c.length));
      const height = rows * 5 + 2;
      if (y + height > pageH - margin) {
        doc.addPage();
        y = margin;
        header();
        doc
          .setFont("helvetica", "normal")
          .setFontSize(10)
          .setTextColor(...DARK);
      }
      cells.forEach((cell, i) => doc.text(cell, cols[i], y));
      y += height;
      doc.setDrawColor(...LINE).line(margin, y - 3, pageW - margin, y - 3);
    }
  });

  const suffix = orders.length === 1 ? orders[0].supplier : "fournisseurs";
  const safe = suffix
    .normalize("NFD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`commande-${safe || "fournisseurs"}.pdf`);
}
