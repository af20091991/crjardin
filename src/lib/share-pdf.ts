import { jsPDF } from "jspdf";
import type { SharedIntervention, SharedClientData } from "@/lib/share.functions";

const GREEN: [number, number, number] = [76, 138, 47];
const DARK: [number, number, number] = [45, 55, 40];
const MUTED: [number, number, number] = [120, 120, 110];
const LIGHT: [number, number, number] = [240, 244, 236];

const TASK_LABELS: Record<string, string> = {
  realise: "Réalisé", partiel: "Partiel", reporte: "Reporté", impossible: "Non réalisable",
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
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const ensureSpace = (h: number) => { if (y + h > pageH - margin - 6) { doc.addPage(); y = margin; } };

  const heading = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y - 1, contentW, 9, 1.5, 1.5, "F");
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin + 3, y + 5.5);
    y += 13;
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

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Compte-rendu d'intervention", margin, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(client.name, margin, 21);
  y = 36;

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(iv.title ?? iv.intervention_type ?? "Intervention", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text([iv.reference, dateStr].filter(Boolean).join(" · "), margin, y);
  y += 9;
  doc.setTextColor(...DARK);

  if (iv.summary) { heading("Résumé"); paragraph(iv.summary); }

  if (iv.tasks.length > 0) {
    heading("Travaux réalisés");
    iv.tasks.forEach((t) => {
      ensureSpace(6);
      const status = t.status && t.status !== "realise" ? ` (${TASK_LABELS[t.status] ?? t.status})` : "";
      paragraph(`• ${t.label}${status}${t.note ? " — " + t.note : ""}`);
    });
  }

  if (iv.garden_state) { heading("État du jardin"); paragraph(iv.garden_state); }
  if (iv.recommendations_text) { heading("Préconisations"); paragraph(iv.recommendations_text); }
  if (iv.upcoming_works) { heading("Travaux à prévoir"); paragraph(iv.upcoming_works); }

  const photos = iv.photos.filter((p) => p.url);
  if (photos.length > 0) {
    heading("Photos");
    const cols = 2;
    const gap = 4;
    const w = (contentW - gap) / cols;
    const h = w * 0.7;
    let col = 0;
    for (const p of photos) {
      try {
        const img = await loadImage(p.url!);
        if (col === 0) ensureSpace(h + 4);
        const x = margin + col * (w + gap);
        doc.addImage(img, "JPEG", x, y, w, h, undefined, "FAST");
        col++;
        if (col >= cols) { col = 0; y += h + 4; }
      } catch { /* skip */ }
    }
    if (col !== 0) y += h + 4;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${client.name} · Compte-rendu`, margin, pageH - 8);
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
  const fname = parts.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  doc.save(`${fname}.pdf`);
}
