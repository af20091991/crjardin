import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { WorksiteSheet } from "@/lib/worksite";
import { worksitePhotoUrl } from "@/lib/worksite";

const GREEN: [number, number, number] = [76, 138, 47];
const DARK: [number, number, number] = [45, 55, 40];
const MUTED: [number, number, number] = [120, 120, 110];
const LIGHT: [number, number, number] = [240, 244, 236];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function exportWorksiteSheetPdf(sheet: WorksiteSheet): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  const dateStr = sheet.intervention_date
    ? new Date(sheet.intervention_date).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "Date non définie";

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

  const line = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFont("helvetica", "bold");
    doc.text(`${label} : `, margin, y);
    const w = doc.getTextWidth(`${label} : `);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", contentW - w);
    doc.text(lines, margin + w, y);
    y += Math.max(lines.length, 1) * 5.4 + 0.6;
  };

  const bullets = (items: string[]) => {
    if (!items.length) { ensureSpace(6); doc.setTextColor(...MUTED); doc.text("—", margin, y); doc.setTextColor(...DARK); y += 6; return; }
    for (const it of items) {
      const lines = doc.splitTextToSize(it, contentW - 6);
      ensureSpace(lines.length * 5 + 1);
      doc.text("•", margin, y);
      doc.text(lines, margin + 5, y);
      y += lines.length * 5 + 1;
    }
  };

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 32, "F");
  try {
    const img = await loadImage(logo);
    doc.addImage(img, "PNG", margin, 6, 18, 18);
  } catch { /* logo optionnel */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Fiche chantier", margin + 22, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Préparation d'intervention", margin + 22, 23);
  y = 42;
  doc.setTextColor(...DARK);

  // Client
  heading("Informations client");
  const clientName = [sheet.civility?.trim(), sheet.client_name?.trim()].filter(Boolean).join(" ");
  line("Client", clientName);
  line("Téléphone", sheet.client_phone || "—");
  if (sheet.client_phone_backup) line("Tél. en cas d'absence", sheet.client_phone_backup);
  if (sheet.contact_person) line("Personne à contacter", sheet.contact_person);
  line("Adresse", sheet.address || "—");
  if (sheet.access_complement) line("Complément d'accès", sheet.access_complement);
  line("Date d'intervention", dateStr);
  if (sheet.intervenant) line("Intervenant(e)", sheet.intervenant);
  line("Client présent", sheet.client_present == null ? "—" : sheet.client_present ? "Oui" : "Non");
  line("Évacuation déchets verts", sheet.green_waste == null ? "—" : sheet.green_waste ? "Oui" : "Non");

  heading("Matériel nécessaire");
  bullets(sheet.equipment);

  heading("EPI");
  bullets(sheet.epi);

  heading("Travaux à réaliser (ordre d'exécution)");
  if (sheet.tasks.length) {
    sheet.tasks.forEach((t, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${t}`, contentW - 4);
      ensureSpace(lines.length * 5 + 1);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 1;
    });
  } else bullets([]);

  heading("Checklist avant départ");
  bullets(sheet.checklist);

  if (sheet.notes?.trim()) {
    heading("Notes complémentaires");
    const lines = doc.splitTextToSize(sheet.notes.trim(), contentW);
    lines.forEach((l: string) => { ensureSpace(5.4); doc.text(l, margin, y); y += 5.4; });
  }

  if (sheet.photos.length) {
    heading("Photos du chantier");
    const cols = 2;
    const gap = 4;
    const w = (contentW - gap) / cols;
    const h = w * 0.7;
    let col = 0;
    for (const p of sheet.photos) {
      try {
        const url = await worksitePhotoUrl(p);
        const img = await loadImage(url);
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
    doc.text("De la graine au jardin — Fiche chantier", margin, pageH - 8);
    doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }

  const dateSafe = (sheet.intervention_date ?? "").slice(0, 10);
  const parts = ["Fiche chantier", sheet.civility?.trim(), sheet.client_name?.trim(), dateSafe]
    .filter(Boolean)
    .join(" ");
  const fname = parts.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  doc.save(`${fname || "Fiche chantier"}.pdf`);
}