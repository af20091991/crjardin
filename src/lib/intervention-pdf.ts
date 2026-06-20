import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { Intervention, InterventionTask, InterventionPhoto } from "@/lib/interventions";
import { TASK_STATUS_META, type TaskStatus, signedPhotoUrl } from "@/lib/interventions";
import type { Client } from "@/lib/clients";
import { gardenLabel } from "@/lib/clients";
import type { GardenHealth, Recommendation } from "@/lib/garden";
import { HEALTH_RATING_META, type HealthRating, RECO_STATUS_META, type RecommendationStatus } from "@/lib/garden";
import { recommendationPrice, formatEuro } from "@/lib/garden";

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

export interface InterventionReportData {
  intervention: Intervention;
  client: Client;
  tasks: InterventionTask[];
  photos: InterventionPhoto[];
  health: GardenHealth[];
  recommendations: Recommendation[];
  companyName?: string;
  authorName?: string;
  signatureData?: string;
  stampData?: string;
}

export async function exportInterventionPdf(data: InterventionReportData): Promise<void> {
  const { intervention: iv, client, tasks, photos, health, recommendations } = data;
  const company = data.companyName?.trim() || "De la graine au jardin";
  const garden = gardenLabel(client);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  const dateStr = new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.text(garden, margin, pageH - 8);
      doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
    }
  };

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin - 6) { doc.addPage(); y = margin; }
  };

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
    if (!text?.trim()) { ensureSpace(5); doc.setTextColor(...MUTED); doc.text("—", margin, y); doc.setTextColor(...DARK); y += 6; return; }
    const lines = doc.splitTextToSize(text.trim(), contentW);
    for (const line of lines) { ensureSpace(5); doc.text(line, margin, y); y += 5; }
    y += 2;
  };

  // ---- Cover ----
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 70, "F");
  try {
    const img = await loadImage(logo);
    doc.addImage(img, "PNG", margin, 16, 20, 20);
  } catch { /* logo optionnel */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Compte-rendu d'intervention", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(company, margin, 60);
  y = 84;

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(iv.title ?? garden, margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const infoLines = [
    iv.reference ? `Référence : ${iv.reference}` : null,
    `Client : ${garden}`,
    client.address ? `Adresse : ${client.address}` : null,
    `Date : ${dateStr}`,
    `Type d'intervention : ${iv.intervention_type ?? "Entretien"}`,
    client.contract_type ? `Contrat : ${client.contract_type}${client.frequency ? ` (${client.frequency})` : ""}` : null,
  ].filter(Boolean) as string[];
  for (const line of infoLines) { doc.text(line, margin, y); y += 6; }
  y += 4;
  doc.setTextColor(...DARK);

  // ---- Synthèse ----
  heading("Synthèse de l'intervention");
  paragraph(iv.summary ?? "");

  // ---- Travaux ----
  heading("Travaux réalisés");
  if (tasks.length === 0) paragraph("");
  else {
    for (const t of tasks) {
      const st = (t.status as TaskStatus) in TASK_STATUS_META ? (t.status as TaskStatus) : "realise";
      const label = `${t.label}  —  ${TASK_STATUS_META[st].label}`;
      const lines = doc.splitTextToSize(label, contentW - 6);
      ensureSpace(lines.length * 5 + 1);
      doc.setFont("helvetica", "bold");
      doc.text("•", margin, y);
      doc.text(lines, margin + 5, y);
      doc.setFont("helvetica", "normal");
      y += lines.length * 5;
      if (t.note?.trim()) {
        const nl = doc.splitTextToSize(t.note.trim(), contentW - 8);
        ensureSpace(nl.length * 4.5 + 1);
        doc.setTextColor(...MUTED);
        doc.setFontSize(9.5);
        doc.text(nl, margin + 5, y);
        doc.setFontSize(10.5);
        doc.setTextColor(...DARK);
        y += nl.length * 4.5;
      }
      y += 2;
    }
  }

  // ---- État du jardin ----
  if (iv.garden_state?.trim() || health.length) {
    heading("État du jardin");
    if (iv.garden_state?.trim()) paragraph(iv.garden_state);
    for (const h of health) {
      const r = (h.rating as HealthRating) in HEALTH_RATING_META ? (h.rating as HealthRating) : "bon";
      const line = `${h.zone} : ${HEALTH_RATING_META[r].label}${h.note ? ` — ${h.note}` : ""}`;
      const lines = doc.splitTextToSize(line, contentW - 5);
      ensureSpace(lines.length * 5 + 1);
      doc.text("•", margin, y);
      doc.text(lines, margin + 5, y);
      y += lines.length * 5 + 1;
    }
  }

  // ---- Préconisations ----
  if (iv.recommendations_text?.trim() || recommendations.length) {
    heading("Préconisations & conseils");
    if (iv.recommendations_text?.trim()) paragraph(iv.recommendations_text);
    for (const r of recommendations) {
      const st = (r.status as RecommendationStatus) in RECO_STATUS_META ? (r.status as RecommendationStatus) : "en_attente";
      const price = recommendationPrice(r);
      const title = `${r.title}${r.category ? ` [${r.category}]` : ""} — ${RECO_STATUS_META[st].label}${price != null ? ` · ${formatEuro(price)}` : ""}`;
      const lines = doc.splitTextToSize(title, contentW - 6);
      ensureSpace(lines.length * 5 + 1);
      doc.setFont("helvetica", "bold");
      doc.text("•", margin, y);
      doc.text(lines, margin + 5, y);
      doc.setFont("helvetica", "normal");
      y += lines.length * 5;
      if (r.description?.trim()) {
        const dl = doc.splitTextToSize(r.description.trim(), contentW - 8);
        ensureSpace(dl.length * 4.5 + 1);
        doc.setTextColor(...MUTED);
        doc.setFontSize(9.5);
        doc.text(dl, margin + 5, y);
        doc.setFontSize(10.5);
        doc.setTextColor(...DARK);
        y += dl.length * 4.5;
      }
      y += 2;
    }
  }

  if (iv.upcoming_works?.trim()) {
    heading("Travaux prévus — prochaine intervention");
    paragraph(iv.upcoming_works);
  }

  // ---- Photos ----
  const reportPhotos = photos.filter((p) => p.include_in_report);
  if (reportPhotos.length) {
    heading("Photos de l'intervention");
    const cols = 2;
    const gap = 6;
    const imgW = (contentW - gap) / cols;
    const imgH = imgW * 0.72;
    let col = 0;
    let rowY = y;
    for (const p of reportPhotos) {
      if (col === 0) { ensureSpace(imgH + 8); rowY = y; }
      const x = margin + col * (imgW + gap);
      try {
        const url = await signedPhotoUrl(p.storage_path);
        const img = await loadImage(url);
        doc.addImage(img, "JPEG", x, rowY, imgW, imgH);
      } catch {
        doc.setDrawColor(...MUTED);
        doc.rect(x, rowY, imgW, imgH);
      }
      if (p.caption?.trim()) {
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        const cap = doc.splitTextToSize(p.caption.trim(), imgW);
        doc.text(cap.slice(0, 2), x, rowY + imgH + 4);
        doc.setFontSize(10.5);
        doc.setTextColor(...DARK);
      }
      col++;
      if (col >= cols) { col = 0; y = rowY + imgH + 12; }
    }
    if (col !== 0) y = rowY + imgH + 12;
  }

  // ---- Signature ----
  ensureSpace(40);
  y += 6;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  const author = data.authorName?.trim() || company;
  doc.text(`Le prestataire — ${author}`, margin, y);
  const sigW = 60;
  const sigH = 22;
  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, "PNG", margin, y + 2, sigW, sigH);
    } catch { /* signature optionnelle */ }
  }
  // Cachet d'entreprise, à droite de la signature
  if (data.stampData) {
    try {
      const stampW = 34;
      const stampH = 34;
      doc.addImage(data.stampData, "PNG", pageW - margin - stampW, y - 4, stampW, stampH);
    } catch { /* cachet optionnel */ }
  }
  y += sigH + 4;
  doc.line(margin, y, margin + sigW, y);

  footer();

  const dateSafe = iv.intervention_date.slice(0, 10);
  const parts = [
    client.civility?.trim(),
    client.name?.trim(),
    iv.title?.trim() || "Compte-rendu d'intervention",
    dateSafe,
    "De la graine au jardin",
  ]
    .filter(Boolean)
    .join(" ");
  const fileName = parts.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  doc.save(`${fileName}.pdf`);
}