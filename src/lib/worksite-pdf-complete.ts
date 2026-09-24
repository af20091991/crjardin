import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import type { WorksiteSheet } from "@/lib/worksite";
import { worksitePhotoUrl } from "@/lib/worksite";
import { staticGardenMap } from "@/lib/maps.functions";
import { parseWorksiteIntervenants } from "@/lib/worksite-sst";
const GREEN: [number, number, number] = [76, 138, 47];
const DARK: [number, number, number] = [45, 55, 40];
const MUTED: [number, number, number] = [120, 120, 110];
const LIGHT: [number, number, number] = [240, 244, 236];
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function annotateGardenMap(
  dataUrl: string,
  centerLat: number,
  centerLng: number,
  markers: WorksiteSheet["garden_markers"],
  zoom = 19,
): Promise<string> {
  if (!markers.length) return dataUrl;

  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(image, 0, 0);
  const scale = canvas.width / 640;
  const worldSize = 256 * 2 ** zoom;

  const project = (lat: number, lng: number) => {
    const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
    return {
      x: ((lng + 180) / 360) * worldSize,
      y:
        (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
        worldSize,
    };
  };

  const center = project(centerLat, centerLng);
  const markerRadius = 18 * scale;
  const padding = 8 * scale;
  const fontSize = Math.max(14, Math.round(11 * scale));
  const lineHeight = fontSize * 1.25;

  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = "top";

  markers.forEach((marker, index) => {
    const point = project(marker.lat, marker.lng);
    const x = canvas.width / 2 + (point.x - center.x);
    const y = canvas.height / 2 + (point.y - center.y);

    const mention = [marker.task, marker.note].filter(Boolean).join(" — ");
    const maxTextWidth = Math.min(canvas.width * 0.58, 520 * scale);
    const words = mention.split(/\\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxTextWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);

    const boxW = Math.min(
      maxTextWidth + padding * 2,
      Math.max(
        markerRadius * 2 + padding * 2,
        Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2,
      ),
    );
    const boxH = lines.length * lineHeight + padding * 2;
    const boxX = Math.min(
      Math.max(x + markerRadius + padding, padding),
      canvas.width - boxW - padding,
    );
    const boxY = Math.min(
      Math.max(y - boxH / 2, padding),
      canvas.height - boxH - padding,
    );

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(79,142,51,0.95)";
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#4F8E33";
    ctx.beginPath();
    ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(13, Math.round(12 * scale))}px Arial, sans-serif`;
    ctx.fillText(String(index + 1), x, y);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#2D3728";
    ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, boxX + padding, boxY + padding + lineIndex * lineHeight);
    });
  });

  return canvas.toDataURL("image/png");
}
export async function exportCompleteWorksiteSheetPdf(sheet: WorksiteSheet): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;
  const ensureSpace = (height: number) => {
    if (y + height > pageH - margin - 8) {
      doc.addPage();
      y = margin;
    }
  };
  const section = (title: string) => {
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
  const line = (label: string, value: string | null | undefined) => {
    const text = value?.trim() || "—";
    doc.setFont("helvetica", "bold");
    const labelText = `${label} : `;
    const labelW = doc.getTextWidth(labelText);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentW - labelW);
    ensureSpace(Math.max(lines.length, 1) * 5.4 + 1);
    doc.setFont("helvetica", "bold");
    doc.text(labelText, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(lines, margin + labelW, y);
    y += Math.max(lines.length, 1) * 5.4 + 0.6;
  };
  const bullets = (items: string[]) => {
    if (!items.length) {
      ensureSpace(6);
      doc.setTextColor(...MUTED);
      doc.text("—", margin, y);
      doc.setTextColor(...DARK);
      y += 6;
      return;
    }
    for (const item of items) {
      const lines = doc.splitTextToSize(item, contentW - 6);
      ensureSpace(lines.length * 5 + 1);
      doc.text("•", margin, y);
      doc.text(lines, margin + 5, y);
      y += lines.length * 5 + 1;
    }
  };
  const date = sheet.intervention_date
    ? new Date(sheet.intervention_date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date non définie";
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 32, "F");
  try {
    const image = await loadImage(logo);
    doc.addImage(image, "PNG", margin, 6, 18, 18);
  } catch {
    // Logo optionnel.
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Fiche chantier", margin + 22, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Préparation d'intervention", margin + 22, 23);
  y = 42;
  doc.setTextColor(...DARK);
  section("Informations client");
  line("Client", [sheet.civility?.trim(), sheet.client_name?.trim()].filter(Boolean).join(" "));
  line("Téléphone", sheet.client_phone);
  line("Tél. en cas d'absence", sheet.client_phone_backup);
  line("Personne à contacter", sheet.contact_person);
  line("Adresse", sheet.address);
  line("Complément d'accès", sheet.access_complement);
  line("Date d'intervention", date);
  const intervenants = parseWorksiteIntervenants(sheet.intervenant);
  line("SST / intervenant(e)s", intervenants.length ? intervenants.join(", ") : null);
  line(
    "Client présent",
    sheet.client_present == null ? null : sheet.client_present ? "Oui" : "Non",
  );
  line(
    "Évacuation déchets verts",
    sheet.green_waste == null ? null : sheet.green_waste ? "Oui" : "Non",
  );
  section("Matériel nécessaire");
  bullets(sheet.equipment);
  section("EPI");
  bullets(sheet.epi);
  section("Travaux à réaliser (ordre d'exécution)");
  if (sheet.tasks.length) {
    sheet.tasks.forEach((task, index) => {
      const lines = doc.splitTextToSize(`${index + 1}. ${task}`, contentW - 4);
      ensureSpace(lines.length * 5 + 1);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 1;
    });
  } else {
    bullets([]);
  }
  section("Checklist avant départ");
  bullets(sheet.checklist);
  if (sheet.notes?.trim()) {
    section("Notes complémentaires");
    const lines = doc.splitTextToSize(sheet.notes.trim(), contentW);
    for (const text of lines) {
      ensureSpace(5.4);
      doc.text(text, margin, y);
      y += 5.4;
    }
  }
  if (sheet.recycling_center) {
    section("Déchèterie la plus proche");
    line("Nom", sheet.recycling_center.name);
    line("Adresse", sheet.recycling_center.address);
    line("Distance", `${sheet.recycling_center.distance_km} km`);
    if (sheet.recycling_center.hours.length) {
      line("Horaires", sheet.recycling_center.hours.join(" · "));
    }
  }
  if (sheet.latitude != null && sheet.longitude != null) {
    section("Localisation du chantier");
    line("Latitude", String(sheet.latitude));
    line("Longitude", String(sheet.longitude));
    section("Plan jardin (vue aérienne)");
    try {
      const dataUrl = await staticGardenMap({
        data: {
          lat: sheet.latitude,
          lng: sheet.longitude,
          markers: sheet.garden_markers.map((marker) => ({
            lat: marker.lat,
            lng: marker.lng,
          })),
        },
      });
      if (dataUrl) {
        const annotatedDataUrl = await annotateGardenMap(
          dataUrl,
          sheet.latitude,
          sheet.longitude,
          sheet.garden_markers,
        );
        const image = await loadImage(annotatedDataUrl);
        const imageW = contentW;
        const imageH = imageW * (image.naturalHeight / image.naturalWidth);
        ensureSpace(imageH + 4);
        doc.addImage(image, "PNG", margin, y, imageW, imageH, undefined, "FAST");
        y += imageH + 4;
      }
    } catch {
      // Plan optionnel.
    }
    if (sheet.garden_markers.length) {
      for (const [index, marker] of sheet.garden_markers.entries()) {
        const label = `${index + 1}. ${marker.task}${marker.note ? ` — ${marker.note}` : ""}`;
        const lines = doc.splitTextToSize(label, contentW - 4);
        ensureSpace(lines.length * 5 + 1);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 1;
      }
    }
  }
  if (sheet.photos.length) {
    section("Photos du chantier");
    const gap = 4;
    const columns = 2;
    const imageW = (contentW - gap) / columns;
    const imageH = imageW * 0.7;
    let column = 0;
    for (const photo of sheet.photos) {
      try {
        const url = await worksitePhotoUrl(photo);
        const image = await loadImage(url);
        if (column === 0) {
          ensureSpace(imageH + 4);
        }
        const x = margin + column * (imageW + gap);
        doc.addImage(image, "JPEG", x, y, imageW, imageH, undefined, "FAST");
        column += 1;
        if (column === columns) {
          column = 0;
          y += imageH + 4;
        }
      } catch {
        // Une photo indisponible ne bloque pas l'export.
      }
    }
    if (column !== 0) {
      y += imageH + 4;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("De la graine au jardin — Fiche chantier", margin, pageH - 8);
    doc.text(`${page} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }
  const dateSafe = (sheet.intervention_date ?? "").slice(0, 10);
  const parts = ["Fiche chantier", sheet.civility?.trim(), sheet.client_name?.trim(), dateSafe]
    .filter(Boolean)
    .join(" ");
  const filename = parts
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  doc.save(`${filename || "Fiche chantier"}.pdf`);
}
