import { jsPDF } from "jspdf";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import type { WorksiteSheet } from "@/lib/worksite";
import { worksitePhotoUrl } from "@/lib/worksite";
import {
  calculateStaticGardenMapMarkerLayout,
  staticGardenMap,
} from "@/lib/maps.functions";
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

function normalizeOpeningHours(value: string): string {
  return value
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, " : ")
    .replace(/\s*[–—-]\s*/g, " – ")
    .trim();
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function formatOpeningDay(value: string): string {
  const normalized = normalizeOpeningHours(value);
  if (!normalized) return "—";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
    line("Distance", `${sheet.recycling_center.distance_km.toFixed(1)} km`);
    line(
      "Coordonnées",
      `${formatCoordinate(sheet.recycling_center.lat)}, ${formatCoordinate(sheet.recycling_center.lng)}`,
    );
    if (sheet.recycling_center.hours.length) {
      ensureSpace(8 + sheet.recycling_center.hours.length * 5);
      doc.setFont("helvetica", "bold");
      doc.text("Horaires :", margin, y);
      y += 5.4;
      doc.setFont("helvetica", "normal");
      for (const hour of sheet.recycling_center.hours) {
        const lines = doc.splitTextToSize(formatOpeningDay(hour), contentW - 6);
        ensureSpace(lines.length * 5 + 1);
        doc.text("•", margin, y);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 1;
      }
    }
  }
  if (sheet.latitude != null && sheet.longitude != null) {
    /*
     * La carte est volontairement isolée sur une page dédiée :
     * - elle ne peut jamais être coupée entre deux pages ;
     * - elle occupe au moins une demi-page A4 ;
     * - les repères restent lisibles ;
     * - le PDF ne dépend pas d'une carte Google Maps interactive.
     */
    doc.addPage();
    y = margin;

    section("Plan jardin (vue aérienne)");

    try {
      const validMarkers = sheet.garden_markers.filter(
        (marker) =>
          Number.isFinite(marker.lat) && Number.isFinite(marker.lng),
      );

      const dataUrl = await staticGardenMap({
        data: {
          lat: sheet.latitude,
          lng: sheet.longitude,
          markers: validMarkers.map((marker) => ({
            lat: marker.lat,
            lng: marker.lng,
          })),
        },
      });

      if (!dataUrl) {
        throw new Error("Aucune image de carte n'a pu être générée côté serveur.");
      }

      const imageW = contentW;
      // Ratio 640x540 (scale=2) : environ 150 mm de haut sur une largeur utile A4.
      const imageH = (imageW * 540) / 640;

      ensureSpace(imageH + 4);
      doc.addImage(dataUrl, "PNG", margin, y, imageW, imageH, undefined, "FAST");

      // Les coordonnées restent exactes, mais les badges sont décalés autour
      // des groupes denses afin que chaque repère soit lisible. Un trait fin
      // relie chaque badge à son emplacement géographique réel.
      const markerLayouts = calculateStaticGardenMapMarkerLayout(
        sheet.latitude,
        sheet.longitude,
        validMarkers.map((marker) => ({
          lat: marker.lat,
          lng: marker.lng,
        })),
      );
      const pxToMmX = imageW / 640;
      const pxToMmY = imageH / 540;

      doc.setLineWidth(0.35);
      doc.setDrawColor(76, 138, 47);
      doc.setFillColor(76, 138, 47);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);

      markerLayouts.forEach((layout, index) => {
        const anchorX = margin + layout.anchorX * pxToMmX;
        const anchorY = y + layout.anchorY * pxToMmY;
        const labelX = margin + layout.labelX * pxToMmX;
        const labelY = y + layout.labelY * pxToMmY;

        if (Math.hypot(layout.labelX - layout.anchorX, layout.labelY - layout.anchorY) > 1) {
          // Le point géographique réel reste matérialisé en vert : aucune
          // pastille blanche ne doit pouvoir être confondue avec un repère.
          doc.line(anchorX, anchorY, labelX, labelY);
        }

        doc.ellipse(labelX, labelY, 4.1, 4.1, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(String(index + 1), labelX, labelY + 2.1, { align: "center" });
      });

      y += imageH + 6;
    } catch (error) {
      console.error("Export PDF fiche SST : impossible d'ajouter la carte.", error);
      toast.warning(
        "La carte n'a pas pu être intégrée au PDF. Le reste de la fiche est généré normalement.",
      );
    }

    if (sheet.garden_markers.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);

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
