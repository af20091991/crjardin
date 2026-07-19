import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { Intervention, InterventionTask, InterventionPhoto } from "@/lib/interventions";
import { TASK_STATUS_META, type TaskStatus, signedPhotoUrl, normalizeReportSections } from "@/lib/interventions";
import type { Client } from "@/lib/clients";
import { gardenLabel } from "@/lib/clients";
import type { GardenHealth, Recommendation } from "@/lib/garden";
import {
  HEALTH_RATING_META, type HealthRating, RECO_STATUS_META, type RecommendationStatus,
  RECO_PRIORITY_META, type RecommendationPriority,
  RECO_SEASON_LABELS, type RecommendationSeason,
} from "@/lib/garden";
import { recommendationPrice, formatEuro } from "@/lib/garden";
import type { WorksiteSheet } from "@/lib/worksite";

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
  worksite?: WorksiteSheet | null;
  companyName?: string;
  authorName?: string;
  signatureData?: string;
  stampData?: string;
}

export async function buildInterventionPdf(data: InterventionReportData): Promise<{ blob: Blob; filename: string }> {
  const { intervention: iv, client, tasks, photos, health, recommendations } = data;
  const sections = normalizeReportSections(iv.report_sections);
  const reportRecos = recommendations
    .filter((r) => r.include_in_report ?? true)
    .slice()
    .sort((a, b) => {
      const ap = a.report_position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.report_position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
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
  // Logo dans une pastille blanche en haut à droite (identification de la marque)
  const badge = 30;
  const badgeX = pageW - margin - badge;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, 14, badge, badge, 4, 4, "F");
  try {
    const img = await loadImage(logo);
    doc.addImage(img, "PNG", badgeX + 4, 18, badge - 8, badge - 8, undefined, "NONE");
  } catch { /* logo optionnel */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Compte-rendu d'intervention", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(company, margin, 60);
  y = 84;

  // Première ligne après l'en-tête : civilité + nom du client
  const clientFull = [client.civility?.trim(), client.name?.trim()].filter(Boolean).join(" ") || garden;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(clientFull, margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const infoLines = [
    iv.title?.trim() ? `Objet : ${iv.title.trim()}` : null,
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
  if (sections.summary) {
    heading("Synthèse de l'intervention");
    paragraph(iv.summary ?? "");
  }

  // ---- Fiche jardin (informations utiles au suivi, pas de données internes) ----
  if (sections.worksite && data.worksite) {
    const w = data.worksite;
    const lines: string[] = [];
    if (w.client_name) lines.push(`Jardin : ${w.client_name}`);
    if (w.address) lines.push(`Adresse : ${w.address}`);
    if (w.access_complement) lines.push(`Accès : ${w.access_complement}`);
    if (w.tasks && w.tasks.length) lines.push(`Travaux prévus sur la fiche : ${w.tasks.join(", ")}`);
    if (w.garden_markers && w.garden_markers.length) lines.push(`Repères jardin : ${w.garden_markers.length} point(s) identifié(s)`);
    if (w.notes?.trim()) lines.push(`Observations : ${w.notes.trim()}`);
    if (lines.length) {
      heading("Fiche jardin");
      for (const l of lines) paragraph(l);
    }
  }

  // ---- Travaux ----
  if (sections.tasks) {
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
  }

  // ---- Points positifs ----
  if (sections.positive_points && iv.positive_points?.trim()) {
    heading("Points positifs observés");
    paragraph(iv.positive_points);
  }

  // ---- Points de vigilance ----
  if (sections.attention_points && iv.attention_points?.trim()) {
    heading("Points de vigilance");
    paragraph(iv.attention_points);
  }

  // ---- Évolution du jardin ----
  if (sections.garden_evolution && iv.garden_evolution?.trim()) {
    heading("Évolution du jardin");
    paragraph(iv.garden_evolution);
  }

  // ---- État du jardin ----
  if (sections.garden_state && (iv.garden_state?.trim() || health.length)) {
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
  if (sections.recommendations && (iv.recommendations_text?.trim() || reportRecos.length)) {
    heading("Préconisations & conseils");
    if (iv.recommendations_text?.trim()) paragraph(iv.recommendations_text);
    for (const r of reportRecos) {
      const st = (r.status as RecommendationStatus) in RECO_STATUS_META ? (r.status as RecommendationStatus) : "en_attente";
      const price = recommendationPrice(r);
      const pr = r.priority as RecommendationPriority | null | undefined;
      const se = r.recommended_season as RecommendationSeason | null | undefined;
      const prTxt = pr && RECO_PRIORITY_META[pr] ? ` · ${RECO_PRIORITY_META[pr].label}` : "";
      const seTxt = se && RECO_SEASON_LABELS[se] ? ` · ${RECO_SEASON_LABELS[se]}` : "";
      const title = `${r.title}${r.category ? ` [${r.category}]` : ""} — ${RECO_STATUS_META[st].label}${price != null ? ` · ${formatEuro(price)}` : ""}${prTxt}${seTxt}`;
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

  if (sections.upcoming && iv.upcoming_works?.trim()) {
    heading("Travaux prévus — prochaine intervention");
    paragraph(iv.upcoming_works);
  }

  // ---- Photos ----
  const reportPhotos = photos
    .filter((p) => p.include_in_report)
    .slice()
    .sort((a, b) => a.position - b.position);
  if (sections.photos && reportPhotos.length) {
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
  ensureSpace(52);
  y += 8;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  const author = data.authorName?.trim() || company;

  // Ajoute une image en conservant son ratio d'origine (aucune compression ni redimensionnement forcé).
  const fitImage = async (dataUrl: string, x: number, top: number, maxW: number, maxH: number) => {
    try {
      const img = await loadImage(dataUrl);
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      doc.addImage(dataUrl, "PNG", x, top, w, h, undefined, "NONE");
    } catch { /* image optionnelle */ }
  };

  // Bloc « Signature — l'intervenant » (à gauche)
  const sigW = 62;
  const sigH = 26;
  doc.setFontSize(9.5);
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.text("Signature — l'intervenant", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(8.5);
  doc.text(author, margin, y + 4.5);
  doc.setTextColor(...DARK);
  if (data.signatureData) {
    await fitImage(data.signatureData, margin, y + 7, sigW, sigH);
  }
  doc.line(margin, y + sigH + 9, margin + sigW, y + sigH + 9);

  // Bloc « Cachet — l'entreprise » (à droite)
  const stampW = 40;
  const stampH = 40;
  const stampX = pageW - margin - stampW;
  doc.setFontSize(9.5);
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.text("Cachet — l'entreprise", stampX, y, { align: "left" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(8.5);
  doc.text(company, stampX, y + 4.5);
  doc.setTextColor(...DARK);
  if (data.stampData) {
    // Cachet : conserve le format et la résolution d'origine (ratio préservé, sans compression).
    await fitImage(data.stampData, stampX, y + 7, stampW, stampH);
  }
  y += sigH + 14;

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
  const filename = `${fileName}.pdf`;
  const blob = doc.output("blob");
  return { blob, filename };
}

export async function exportInterventionPdf(data: InterventionReportData): Promise<{ blob: Blob; filename: string }> {
  const built = await buildInterventionPdf(data);
  const url = URL.createObjectURL(built.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = built.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return built;
}