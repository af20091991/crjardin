import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { UploadedPhoto } from "@/lib/storage";

export interface ReportData {
  nomClient: string;
  emailClient: string;
  dateLabel: string;
  travauxPrevus: string[];
  realises: { label: string; note: string }[];
  reportes: { label: string; note: string }[];
  travauxProchaine: string;
  autresRemarques: string;
  photos: UploadedPhoto[];
}

// Palette du carnet Premium, adaptée au rendu PDF (vert profond, crème et encre).
const GREEN: [number, number, number] = [79, 142, 51];
const DARK: [number, number, number] = [48, 55, 45];
const MUTED: [number, number, number] = [112, 116, 106];
const LINE: [number, number, number] = [221, 226, 215];
const SURFACE: [number, number, number] = [247, 249, 243];

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function exportReportPdf(data: ReportData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Le pied de page reprend la discrétion et les filets fins du carnet Premium.
  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.25);
      doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("De la graine au jardin · Rapport de fin de chantier", margin, pageH - 8);
      doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
    }
  };

  // Laisse une zone dédiée au pied de page sur toutes les pages.
  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin - 10) {
      doc.addPage();
      y = margin;
    }
  };

  // En-tête éditorial : marque discrète, grand titre serif et repère Premium.
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.65);
  doc.line(margin, 12, pageW - margin, 12);
  try {
    const img = await loadImage(logo);
    doc.addImage(img, "PNG", margin, 19, 22, 22);
  } catch {
    /* logo optionnel */
  }
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DE LA GRAINE AU JARDIN", margin + 28, 24);
  doc.setTextColor(...DARK);
  doc.setFont("times", "bold");
  doc.setFontSize(23);
  doc.text("Rapport de fin de chantier", margin + 28, 34);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Le carnet du jardin · Compte-rendu d'intervention", margin + 28, 41);

  // Cartouche client/date : surface crème, séparation fine, libellés en capitales.
  const metaY = 51;
  const metaH = 25;
  const dividerX = margin + contentW * 0.63;
  doc.setFillColor(...SURFACE);
  doc.roundedRect(margin, metaY, contentW, metaH, 2, 2, "F");
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.line(dividerX, metaY + 4, dividerX, metaY + metaH - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREEN);
  doc.text("CLIENT", margin + 5, metaY + 7);
  doc.text("DATE D'INTERVENTION", dividerX + 5, metaY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  const clientLines = doc
    .splitTextToSize(data.nomClient.trim() || "—", dividerX - margin - 12)
    .slice(0, 2);
  doc.text(clientLines, margin + 5, metaY + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const dateLines = doc
    .splitTextToSize(data.dateLabel || "—", pageW - margin - dividerX - 10)
    .slice(0, 2);
  doc.text(dateLines, dividerX + 5, metaY + 14);
  y = metaY + metaH + 10;

  const heading = (title: string) => {
    ensureSpace(15);
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...GREEN);
    doc.text(title, margin, y);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 3, margin + 11, y + 3);
    y += 10;
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  const bullet = (text: string) => {
    const lines = doc.splitTextToSize(text, contentW - 5);
    ensureSpace(lines.length * 5 + 1);
    doc.setFillColor(...GREEN);
    doc.circle(margin + 1, y - 1.2, 0.65, "F");
    doc.setTextColor(...DARK);
    doc.text(lines, margin + 5, y);
    y += lines.length * 5 + 1;
  };

  const paragraph = (text: string) => {
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(5);
      doc.setTextColor(...DARK);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 1;
  };

  heading("Travaux prévus");
  if (data.travauxPrevus.length) data.travauxPrevus.forEach(bullet);
  else bullet("Aucun");
  y += 3;

  heading("Travaux réalisés");
  if (data.realises.length)
    data.realises.forEach((t) => bullet(t.note ? `${t.label} (${t.note})` : t.label));
  else bullet("Aucun");
  y += 3;

  heading("Travaux reportés");
  if (data.reportes.length)
    data.reportes.forEach((t) => bullet(t.note ? `${t.label} — motif : ${t.note}` : t.label));
  else bullet("Aucun");
  y += 3;

  if (data.travauxProchaine.trim()) {
    heading("Travaux prévus — prochaine intervention");
    paragraph(data.travauxProchaine.trim());
    y += 3;
  }

  if (data.autresRemarques.trim()) {
    heading("Autres remarques");
    paragraph(data.autresRemarques.trim());
    y += 3;
  }

  // Photos
  if (data.photos.length) {
    heading("Photos du chantier");
    const cols = 2;
    const gap = 6;
    const imgW = (contentW - gap) / cols;
    const imgH = imgW * 0.7;
    let col = 0;
    let rowY = y;
    for (const p of data.photos) {
      if (col === 0) ensureSpace(imgH + gap);
      if (col === 0) rowY = y;
      const x = margin + col * (imgW + gap);
      try {
        const img = await loadImage(p.url);
        doc.addImage(img, "JPEG", x, rowY, imgW, imgH);
      } catch {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, rowY, imgW, imgH, 1.5, 1.5, "S");
      }
      col++;
      if (col >= cols) {
        col = 0;
        y = rowY + imgH + gap;
      }
    }
    if (col !== 0) y = rowY + imgH + gap;
  }

  footer();

  const safe = (data.nomClient || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`rapport-${safe}.pdf`);
}
