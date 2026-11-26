// Assistant AP — export de la liste des fournitures d'un chantier à destination d'un fournisseur.
// Logique pure (groupement + texte) ; le PDF est généré à la demande avec jsPDF.
import type { ApSupply, ApWorksite } from "@/lib/assistant-ap";
import { isNativeApp, nativePlugin } from "@/lib/native-app";
import logo from "@/assets/logo.png";
import type { jsPDF as JsPDF } from "jspdf";

/** Identité de l'entreprise imprimée sur la commande (logo fixe de l'appli + nom et cachet du profil). */
export interface OrderBrand {
  companyName: string;
  stampData: string | null;
}

const DEFAULT_COMPANY = "De la graine au jardin";

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

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

/** Construit le PDF (une section par fournisseur, une page par fournisseur). */
async function renderOrderPdf(
  worksite: Pick<ApWorksite, "client_label" | "scheduled_date" | "date_label">,
  orders: ApSupplierOrder[],
  brand?: OrderBrand,
): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const chantier = worksiteDateText(worksite);
  const company = brand?.companyName?.trim() || DEFAULT_COMPANY;
  // Logo et cachet : chargés une fois, ajoutés seulement s'ils sont disponibles.
  const logoImg = await loadImage(logo).catch(() => null);
  const stampImg = brand?.stampData ? await loadImage(brand.stampData).catch(() => null) : null;
  // Colonnes : article, quantité, livraison, date souhaitée.
  const cols = [margin, margin + 78, margin + 112, margin + 134];
  const widths = [74, 30, 20, pageW - margin - cols[3]];

  orders.forEach((order, index) => {
    if (index > 0) doc.addPage();
    let y = margin;

    // En-tête d'identification : logo + nom de l'entreprise.
    if (logoImg) doc.addImage(logoImg, "PNG", margin, y, 16, 16, undefined, "NONE");
    doc
      .setFont("helvetica", "bold")
      .setFontSize(12)
      .setTextColor(...GREEN);
    doc.text(company, margin + 20, y + 7);
    doc.setDrawColor(...LINE).line(margin, y + 20, pageW - margin, y + 20);
    y += 26;

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
    doc.setFont("helvetica", "bold").text("Référence chantier :", margin, y);
    doc.setFont("helvetica", "normal").text(worksite.client_label.trim() || "—", margin + 40, y);
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

    // Mention de confirmation sous le tableau : l'adresse ouvre un e-mail pré-rempli.
    const contact = "contact@delagraineaujardin.com";
    const subject = `Confirmation de commande — ${worksite.client_label.trim() || "chantier"}`;
    const body = "Bonjour, je vous confirme la bonne réception de votre commande.";
    const mailto = `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const mention = doc.splitTextToSize(
      "Merci de bien vouloir me confirmer le disponible et la prise en compte de la commande ci-dessus par mail à l'adresse :",
      pageW - 2 * margin,
    ) as string[];
    if (y + mention.length * 5 + 16 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    y += 6;
    doc
      .setFont("helvetica", "normal")
      .setFontSize(10)
      .setTextColor(...DARK);
    for (const line of mention) {
      doc.text(line, margin, y);
      y += 5;
    }
    doc.setFont("helvetica", "bold").setTextColor(...GREEN);
    doc.textWithLink(contact, margin, y, { url: mailto });
    y += 5;
    doc.setTextColor(...DARK);

    // Cachet de l'entreprise en bas de la commande, à droite (aucun cachet inventé si absent).
    if (stampImg) {
      const stampW = 50;
      const stampH = 30;
      const ratio = stampImg.naturalWidth / stampImg.naturalHeight || 1;
      let w = stampW;
      let h = w / ratio;
      if (h > stampH) {
        h = stampH;
        w = h * ratio;
      }
      const need = stampH + 14;
      if (y + need > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      const x = pageW - margin - stampW;
      const top = Math.max(y + 8, pageH - margin - stampH - 8);
      doc
        .setFont("helvetica", "normal")
        .setFontSize(8.5)
        .setTextColor(...MUTED);
      doc.text(company, x, top - 2);
      const mime = brand?.stampData?.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(brand?.stampData ?? "", mime, x + stampW - w, top, w, h, undefined, "NONE");
      doc.setTextColor(...DARK);
    }
  });

  return doc;
}

/** PDF d'une commande en base64 (pour l'envoi par e-mail). */
export async function orderPdfBase64(
  worksite: Pick<ApWorksite, "client_label" | "scheduled_date" | "date_label">,
  order: ApSupplierOrder,
  brand?: OrderBrand,
): Promise<string> {
  const doc = await renderOrderPdf(worksite, [order], brand);
  return doc.output("datauristring").split(",")[1] ?? "";
}

/** Génère et télécharge (ou partage sur Android) le PDF des commandes. */
export async function exportOrderPdf(
  worksite: Pick<ApWorksite, "client_label" | "scheduled_date" | "date_label">,
  orders: ApSupplierOrder[],
  brand?: OrderBrand,
): Promise<void> {
  const doc = await renderOrderPdf(worksite, orders, brand);
  const suffix = orders.length === 1 ? orders[0].supplier : "fournisseurs";
  const safe = suffix
    .normalize("NFD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const fileName = `commande-${safe || "fournisseurs"}.pdf`;
  if (!isNativeApp()) {
    doc.save(fileName);
    return;
  }
  // Dans l'appli Android, le WebView ne télécharge pas de blob : on écrit le PDF en cache
  // puis on ouvre le partage natif (e-mail, messagerie, etc.).
  try {
    const filesystem = nativePlugin("Filesystem");
    const share = nativePlugin("Share");
    const base64 = doc.output("datauristring").split(",")[1] ?? "";
    const written = await filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: "CACHE",
      recursive: true,
    });
    await share.share({
      title: fileName,
      dialogTitle: "Envoyer la commande",
      files: [written.uri],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) return;
    throw new Error("Partage du PDF indisponible : mettez l'application à jour.");
  }
}
