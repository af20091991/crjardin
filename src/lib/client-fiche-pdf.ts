import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";
import { CLIENT_TYPE_META, REPORT_POLICY_META, clientEmails, type Client } from "@/lib/clients";
import { PDF_BRAND } from "@/lib/pdf-brand";

const GREEN = PDF_BRAND.green;
const DARK = PDF_BRAND.dark;
const MUTED = PDF_BRAND.muted;
const LINE = PDF_BRAND.line;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logo;
  });
}

/** Export PDF de la fiche d'identité d'un client (lecture seule, aucune donnée inventée). */
export async function exportClientFichePdf(client: Client): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;

  const logoImg = await loadLogo();
  if (logoImg) {
    doc.addImage(logoImg, "PNG", margin, y, 22, 22);
  }
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(client.name || "Client", margin + (logoImg ? 28 : 0), y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Fiche client · De la graine au jardin", margin + (logoImg ? 28 : 0), y + 16);
  y += 30;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const rows: [string, string][] = [
    ["Type", client.client_type ? CLIENT_TYPE_META[client.client_type].label : "—"],
    ["Adresse", client.address?.trim() || "—"],
    ["Téléphone", client.phone?.trim() || "—"],
    ["E-mail(s)", clientEmails(client).join(", ") || "—"],
    ["Contrat", client.contract_type?.trim() || "—"],
    ["Fréquence", client.frequency?.trim() || "—"],
    ["Compte-rendu", REPORT_POLICY_META[client.report_policy]?.label ?? "—"],
    ["Créé le", formatDate(client.created_at)],
    ["Mis à jour le", formatDate(client.updated_at)],
  ];

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (y > pageH - 30) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(value, contentW - 42) as string[];
    doc.text(lines, margin + 42, y);
    y += Math.max(6, lines.length * 5);
  }

  const notes = [
    ["Notes", client.notes?.trim()],
    ["Notes compte-rendu", client.cr_notes?.trim()],
  ] as const;
  for (const [title, text] of notes) {
    if (!text) continue;
    y += 4;
    if (y > pageH - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text(title, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      if (y > pageH - 30) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("De la graine au jardin · Fiche client", margin, pageH - 8);
    doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }

  const safe = (client.name || "client").replace(/[^\w-]+/g, "_").slice(0, 60);
  doc.save(`fiche-${safe}.pdf`);
}
