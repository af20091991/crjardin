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

const GREEN: [number, number, number] = [76, 138, 47];
const DARK: [number, number, number] = [45, 55, 40];
const MUTED: [number, number, number] = [110, 110, 100];

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

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // En-tête avec logo
  try {
    const img = await loadImage(logo);
    doc.addImage(img, "PNG", margin, y, 22, 22);
  } catch {
    /* logo optionnel */
  }
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Rapport de fin de chantier", margin + 26, y + 9);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("De la graine au jardin · paysagiste", margin + 26, y + 16);
  y += 28;

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Infos client
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Client : ${data.nomClient || "—"}`, margin, y);
  y += 6;
  doc.text(`Date d'intervention : ${data.dateLabel}`, margin, y);
  y += 10;

  const heading = (title: string) => {
    ensureSpace(12);
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, margin, y);
    y += 7;
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  const bullet = (text: string) => {
    const lines = doc.splitTextToSize(text, contentW - 5);
    ensureSpace(lines.length * 5 + 1);
    doc.text("•", margin, y);
    doc.text(lines, margin + 5, y);
    y += lines.length * 5 + 1;
  };

  const paragraph = (text: string) => {
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(5);
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
    data.reportes.forEach((t) =>
      bullet(t.note ? `${t.label} — motif : ${t.note}` : t.label),
    );
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
        doc.setDrawColor(...MUTED);
        doc.rect(x, rowY, imgW, imgH);
      }
      col++;
      if (col >= cols) {
        col = 0;
        y = rowY + imgH + gap;
      }
    }
    if (col !== 0) y = rowY + imgH + gap;
  }

  const safe = (data.nomClient || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`rapport-${safe}.pdf`);
}