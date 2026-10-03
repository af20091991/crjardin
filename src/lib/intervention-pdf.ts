import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { Intervention, InterventionTask, InterventionPhoto } from "@/lib/interventions";
import {
  TASK_STATUS_META,
  type TaskStatus,
  signedPhotoUrl,
  normalizeReportSections,
} from "@/lib/interventions";
import type { Client } from "@/lib/clients";
import { gardenLabel } from "@/lib/clients";
import { reportRecipient } from "@/lib/report-recipient";
import type { GardenHealth, Recommendation } from "@/lib/garden";
import {
  HEALTH_RATING_META,
  type HealthRating,
  RECO_STATUS_META,
  type RecommendationStatus,
  RECO_PRIORITY_META,
  type RecommendationPriority,
  RECO_SEASON_LABELS,
  type RecommendationSeason,
} from "@/lib/garden";
import { recommendationPrice, formatEuro } from "@/lib/garden";
import type { WorksiteSheet } from "@/lib/worksite";

// Palette du carnet Premium, adaptée au rendu PDF (vert profond, crème et encre).
const GREEN: [number, number, number] = [79, 142, 51];
const DARK: [number, number, number] = [48, 55, 45];
const MUTED: [number, number, number] = [112, 116, 106];
const LINE: [number, number, number] = [221, 226, 215];
const SURFACE: [number, number, number] = [247, 249, 243];

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

export async function buildInterventionPdf(
  data: InterventionReportData,
): Promise<{ blob: Blob; filename: string }> {
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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.25);
      doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.text(`De la graine au jardin · ${garden}`, margin, pageH - 8);
      doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
    }
  };

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

  // Puce ronde verte, comme les repères du carnet Premium.
  const dot = (lineY: number) => {
    doc.setFillColor(...GREEN);
    doc.circle(margin + 1, lineY - 1.2, 0.65, "F");
  };

  const paragraph = (text: string) => {
    if (!text?.trim()) {
      ensureSpace(5);
      doc.setTextColor(...MUTED);
      doc.text("—", margin, y);
      doc.setTextColor(...DARK);
      y += 6;
      return;
    }
    const lines = doc.splitTextToSize(text.trim(), contentW);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 2;
  };

  // ---- En-tête éditorial : filet vert, marque, grand titre serif ----
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
  doc.text(company, margin + 28, 41);

  // Destinataire (personne) et jamais un nom de lieu précédé d'une civilité.
  // Le lieu du chantier apparaît dans le cartouche « Client ».
  const recipient = reportRecipient({ civility: client.civility, name: client.name }, garden);
  const clientFull = recipient.line || garden;

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
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(
    doc.splitTextToSize(clientFull, dividerX - margin - 12).slice(0, 1),
    margin + 5,
    metaY + 14,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const placeLine = [garden !== clientFull ? garden : null, client.address]
    .filter(Boolean)
    .join(" · ");
  if (placeLine)
    doc.text(
      doc.splitTextToSize(placeLine, dividerX - margin - 12).slice(0, 2),
      margin + 5,
      metaY + 19,
    );
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text(
    doc.splitTextToSize(dateStr, pageW - margin - dividerX - 10).slice(0, 2),
    dividerX + 5,
    metaY + 14,
  );
  y = metaY + metaH + 8;

  // Détails de l'intervention : libellé en capitales, valeur en encre.
  const infoRows: [string, string][] = [
    ["OBJET", iv.title?.trim() ?? ""],
    ["RÉFÉRENCE", iv.reference ?? ""],
    ["TYPE", iv.intervention_type ?? "Entretien"],
    [
      "CONTRAT",
      client.contract_type
        ? `${client.contract_type}${client.frequency ? ` (${client.frequency})` : ""}`
        : "",
    ],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  for (const [label, value] of infoRows) {
    const vl = doc.splitTextToSize(value, contentW - 32);
    ensureSpace(vl.length * 5 + 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREEN);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(vl, margin + 28, y);
    y += vl.length * 5 + 1;
  }
  y += 6;
  doc.setFontSize(10.5);
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
    if (w.tasks && w.tasks.length)
      lines.push(`Travaux prévus sur la fiche : ${w.tasks.join(", ")}`);
    if (w.garden_markers && w.garden_markers.length)
      lines.push(`Repères jardin : ${w.garden_markers.length} point(s) identifié(s)`);
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
        const st =
          (t.status as TaskStatus) in TASK_STATUS_META ? (t.status as TaskStatus) : "realise";
        const label = `${t.label}  —  ${TASK_STATUS_META[st].label}`;
        const lines = doc.splitTextToSize(label, contentW - 6);
        ensureSpace(lines.length * 5 + 1);
        dot(y);
        doc.setFont("helvetica", "bold");
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
      const r =
        (h.rating as HealthRating) in HEALTH_RATING_META ? (h.rating as HealthRating) : "bon";
      const line = `${h.zone} : ${HEALTH_RATING_META[r].label}${h.note ? ` — ${h.note}` : ""}`;
      const lines = doc.splitTextToSize(line, contentW - 5);
      ensureSpace(lines.length * 5 + 1);
      dot(y);
      doc.text(lines, margin + 5, y);
      y += lines.length * 5 + 1;
    }
  }

  // ---- Préconisations ----
  if (sections.recommendations && (iv.recommendations_text?.trim() || reportRecos.length)) {
    heading("Préconisations & conseils");
    if (iv.recommendations_text?.trim()) paragraph(iv.recommendations_text);
    for (const r of reportRecos) {
      const st =
        (r.status as RecommendationStatus) in RECO_STATUS_META
          ? (r.status as RecommendationStatus)
          : "en_attente";
      const price = recommendationPrice(r);
      const pr = r.priority as RecommendationPriority | null | undefined;
      const se = r.recommended_season as RecommendationSeason | null | undefined;
      const prTxt = pr && RECO_PRIORITY_META[pr] ? ` · ${RECO_PRIORITY_META[pr].label}` : "";
      const seTxt = se && RECO_SEASON_LABELS[se] ? ` · ${RECO_SEASON_LABELS[se]}` : "";
      const title = `${r.title}${r.category ? ` [${r.category}]` : ""} — ${RECO_STATUS_META[st].label}${price != null ? ` · ${formatEuro(price)}` : ""}${prTxt}${seTxt}`;
      const lines = doc.splitTextToSize(title, contentW - 6);
      ensureSpace(lines.length * 5 + 1);
      dot(y);
      doc.setFont("helvetica", "bold");
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
      if (col === 0) {
        ensureSpace(imgH + 8);
        rowY = y;
      }
      const x = margin + col * (imgW + gap);
      try {
        const url = await signedPhotoUrl(p.storage_path);
        const img = await loadImage(url);
        doc.addImage(img, "JPEG", x, rowY, imgW, imgH);
      } catch {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, rowY, imgW, imgH, 1.5, 1.5, "S");
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
      if (col >= cols) {
        col = 0;
        y = rowY + imgH + 12;
      }
    }
    if (col !== 0) y = rowY + imgH + 12;
  }

  // ---- Signature ----
  ensureSpace(52);
  y += 8;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  const author = data.authorName?.trim() || company;

  // Ajoute une image en conservant son ratio d'origine (aucune compression ni redimensionnement forcé).
  const fitImage = async (dataUrl: string, x: number, top: number, maxW: number, maxH: number) => {
    try {
      const img = await loadImage(dataUrl);
      const ratio =
        img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      doc.addImage(dataUrl, "PNG", x, top, w, h, undefined, "NONE");
    } catch {
      /* image optionnelle */
    }
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
    recipient.isPlaceOnly ? null : client.civility?.trim(),
    client.name?.trim(),
    iv.title?.trim() || "Compte-rendu d'intervention",
    dateSafe,
    "De la graine au jardin",
  ]
    .filter(Boolean)
    .join(" ");
  const fileName = parts
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const filename = `${fileName}.pdf`;
  const blob = doc.output("blob");
  return { blob, filename };
}

export async function exportInterventionPdf(
  data: InterventionReportData,
): Promise<{ blob: Blob; filename: string }> {
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
