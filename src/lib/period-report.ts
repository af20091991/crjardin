import { jsPDF } from "jspdf";
import type { Intervention } from "@/lib/interventions";
import type { Client } from "@/lib/clients";
import type { Recommendation } from "@/lib/garden";
import { recommendationPrice, formatEuro } from "@/lib/garden";

const GREEN: [number, number, number] = [76, 138, 47];
const DARK: [number, number, number] = [45, 55, 40];
const MUTED: [number, number, number] = [120, 120, 110];

export function exportPeriodReport(opts: {
  label: string;
  from: Date;
  to: Date;
  interventions: Intervention[];
  clients: Client[];
  recommendations: Recommendation[];
  companyName?: string;
}): void {
  const { label, from, to, interventions, clients, recommendations } = opts;
  const company = opts.companyName?.trim() || "Jardin Pro";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  const inRange = (d: string) => {
    const t = new Date(d).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };
  const ivs = interventions.filter((i) => inRange(i.intervention_date));
  const recos = recommendations.filter((r) => inRange(r.created_at));
  const accepted = recos.filter((r) => r.status === "acceptee" || r.status === "realisee");
  const revenue = accepted.reduce((s, r) => s + (recommendationPrice(r) ?? 0), 0);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Client";

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Rapport d'activité", margin, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${company} · ${label}`, margin, 20);
  y = 36;

  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  const stats = [
    ["Interventions réalisées", String(ivs.filter((i) => i.status === "termine").length)],
    ["Total interventions", String(ivs.length)],
    ["Préconisations émises", String(recos.length)],
    ["Préconisations acceptées", String(accepted.length)],
    ["Chiffre d'affaires accepté", formatEuro(revenue)],
  ];
  stats.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.text(k, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(v, pageW - margin, y, { align: "right" });
    y += 8;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Détail des interventions", margin, y);
  y += 7;
  doc.setTextColor(...DARK);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");

  const pageH = doc.internal.pageSize.getHeight();
  ivs.forEach((iv) => {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    const date = new Date(iv.intervention_date).toLocaleDateString("fr-FR");
    doc.text(`${date} — ${clientName(iv.client_id)}${iv.intervention_type ? " · " + iv.intervention_type : ""}`, margin, y);
    y += 6;
  });
  if (ivs.length === 0) { doc.setTextColor(...MUTED); doc.text("Aucune intervention sur la période.", margin, y); }

  doc.save(`Rapport_${label.replace(/[^\w-]/g, "_")}.pdf`);
}
