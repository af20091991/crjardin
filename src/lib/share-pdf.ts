import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { SharedIntervention, SharedClientData } from "@/lib/share.functions";

// Palette du carnet Premium, adaptée au rendu PDF (vert profond, crème et encre).
const GREEN: [number, number, number] = [79, 142, 51];
const DARK: [number, number, number] = [48, 55, 45];
const MUTED: [number, number, number] = [112, 116, 106];
const LINE: [number, number, number] = [221, 226, 215];
const SURFACE: [number, number, number] = [247, 249, 243];

const TASK_LABELS: Record<string, string> = {
  realise: "Réalisé",
  partiel: "Partiel",
  reporte: "Reporté",
  impossible: "Non réalisable",
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Libellé client avec civilité : « Madame Dupont ». */
function clientLabel(client: SharedClientData["client"]): string {
  return [client.civility?.trim(), client.name?.trim()].filter(Boolean).join(" ");
}

export async function exportSharedInterventionPdf(
  iv: SharedIntervention,
  client: SharedClientData["client"],
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  const dateStr = new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin - 10) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (title: string) => {
    y += 5;
    ensureSpace(16);
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
    doc.setFontSize(10.5);
  };

  const paragraph = (text: string) => {
    const lines = doc.splitTextToSize(text, contentW);
    lines.forEach((line: string) => {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 5.4;
    });
    y += 2;
  };

  // En-tête éditorial : filet vert, marque, grand titre serif, cartouche crème.
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.65);
  doc.line(margin, 12, pageW - margin, 12);
  try {
    const img = await loadImage(logo);
    doc.addImage(img, "PNG", margin, 19, 22, 22, undefined, "NONE");
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
  doc.text("Compte-rendu d'intervention", margin + 28, 34);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Le carnet du jardin", margin + 28, 41);

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
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(
    doc.splitTextToSize(clientLabel(client) || "—", dividerX - margin - 12).slice(0, 2),
    margin + 5,
    metaY + 14,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    doc.splitTextToSize(dateStr, pageW - margin - dividerX - 10).slice(0, 2),
    dividerX + 5,
    metaY + 14,
  );
  y = metaY + metaH + 11;

  doc.setTextColor(...DARK);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(iv.title ?? iv.intervention_type ?? "Intervention", margin, y);
  y += 6;
  if (iv.reference) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(`Référence ${iv.reference}`, margin, y);
    y += 6;
  }
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);

  if (iv.summary) {
    heading("Résumé");
    paragraph(iv.summary);
  }

  if (iv.tasks.length > 0) {
    heading("Travaux réalisés");
    iv.tasks.forEach((t) => {
      ensureSpace(6);
      const status =
        t.status && t.status !== "realise" ? ` (${TASK_LABELS[t.status] ?? t.status})` : "";
      doc.setFillColor(...GREEN);
      doc.circle(margin + 1, y - 1.2, 0.65, "F");
      const lines = doc.splitTextToSize(
        `${t.label}${status}${t.note ? " — " + t.note : ""}`,
        contentW - 5,
      );
      lines.forEach((line: string) => {
        ensureSpace(6);
        doc.text(line, margin + 5, y);
        y += 5.4;
      });
      y += 1;
    });
  }

  if (iv.garden_state) {
    heading("État du jardin");
    paragraph(iv.garden_state);
  }
  if (iv.recommendations_text) {
    heading("Préconisations");
    paragraph(iv.recommendations_text);
  }
  if (iv.upcoming_works) {
    heading("Travaux à prévoir");
    paragraph(iv.upcoming_works);
  }

  const photos = iv.photos.filter((p) => p.url);
  if (photos.length > 0) {
    heading("Photos");
    const cols = 2;
    const gap = 4;
    const w = (contentW - gap) / cols;
    const h = w * 0.7;
    let col = 0;
    let rowY = y;
    for (const p of photos) {
      try {
        const img = await loadImage(p.url!);
        if (col === 0) {
          ensureSpace(h + 12);
          rowY = y;
        }
        const x = margin + col * (w + gap);
        doc.addImage(img, "JPEG", x, rowY, w, h, undefined, "FAST");
        if (p.caption?.trim()) {
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          const cap = doc.splitTextToSize(p.caption.trim(), w);
          doc.text(cap.slice(0, 2), x, rowY + h + 4);
          doc.setFontSize(10.5);
          doc.setTextColor(...DARK);
        }
        col++;
        if (col >= cols) {
          col = 0;
          y = rowY + h + 12;
        }
      } catch {
        /* skip */
      }
    }
    if (col !== 0) y = rowY + h + 12;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`De la graine au jardin · ${clientLabel(client)}`, margin, pageH - 8);
    doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }

  const dateSafe = (iv.intervention_date ?? "").slice(0, 10);
  const parts = [
    client.civility?.trim(),
    client.name?.trim(),
    iv.title?.trim() || iv.intervention_type?.trim() || "Compte-rendu d'intervention",
    dateSafe,
    "De la graine au jardin",
  ]
    .filter(Boolean)
    .join(" ");
  const fname = parts
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  doc.save(`${fname}.pdf`);
}
