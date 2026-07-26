import { formatEuro } from "@/lib/pilot";
import type { Kpis, PilotSettings } from "@/lib/pilot";
import type { ChargesAnalysis, ProjectionBase } from "@/lib/pilot-charges";
import type { AnnualRow } from "@/lib/pilot-annual";
import type { PortfolioRow } from "@/lib/pilot-portfolio";
import type { RealHoursResolution } from "@/lib/pilot-real-hours";

/**
 * Analyse automatique du dirigeant.
 * Règle : une information n'est produite QUE si toutes les données qu'elle
 * utilise existent réellement dans Pilot Pro. Aucune estimation, aucune
 * extrapolation implicite, aucune donnée incertaine.
 */
export type InsightTone = "positive" | "neutral" | "warning";

export interface DirectorInsight {
  id: string;
  theme: string;
  text: string;
  tone: InsightTone;
  /** Poids de décision : plus élevé = affiché en premier. */
  weight: number;
}

const eur = (n: number) => formatEuro(n);
const pct = (n: number) => `${n >= 0 ? "" : ""}${n.toFixed(0)} %`;
const hrs = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} h`;

export function buildDirectorInsights(params: {
  k: Kpis;
  settings: PilotSettings;
  annual: AnnualRow[];
  charges: ChargesAnalysis | null;
  projection: ProjectionBase | null;
  portfolio: PortfolioRow[];
  hours: RealHoursResolution | null;
  opportunities?: { pendingValue: number; acceptedValue: number; invoicedCa: number } | null;
  year: number;
}): DirectorInsight[] {
  const { k, settings, annual, charges, projection, portfolio, hours, opportunities, year } = params;
  const out: DirectorInsight[] = [];
  const add = (id: string, theme: string, text: string, tone: InsightTone, weight: number) =>
    out.push({ id, theme, text, tone, weight });

  const yearRow = annual.find((a) => a.year === year) ?? null;
  const prevRow = annual.find((a) => a.year === year - 1) ?? null;

  // ---- Économique / CA ----
  if (yearRow && yearRow.caHt > 0) {
    add("ca-annuel", "CA", `CA ${year} enregistré à date : ${eur(yearRow.caHt)} sur ${yearRow.nbLignes} lignes facturées.`, "neutral", 90);
  }
  if (yearRow && prevRow && prevRow.caHt > 0) {
    const evo = ((yearRow.caHt - prevRow.caHt) / prevRow.caHt) * 100;
    add(
      "ca-evol",
      "CA",
      `Par rapport à ${year - 1} (${eur(prevRow.caHt)}), le CA évolue de ${evo >= 0 ? "+" : ""}${pct(evo)}.`,
      evo >= 0 ? "positive" : "warning",
      95,
    );
  }
  if (k.caPrevYTD > 0) {
    add(
      "ca-ytd",
      "CA",
      `À date équivalente, le CA cumulé est ${k.progression >= 0 ? "supérieur" : "inférieur"} de ${pct(Math.abs(k.progression))} à ${year - 1}.`,
      k.progression >= 0 ? "positive" : "warning",
      88,
    );
  }
  if (k.projection > 0 && k.caYear > 0) {
    add("ca-projection", "Projection", `Au rythme actuel, la projection de clôture ${year} est de ${eur(k.projection)}.`, "neutral", 80);
  }

  // ---- Bénéfice / budget ----
  if (yearRow && yearRow.caHt > 0 && yearRow.charges > 0) {
    add(
      "benefice",
      "Budget",
      `Bénéfice brut ${year} : ${eur(yearRow.beneficeBrut)} (${yearRow.margePct != null ? pct(yearRow.margePct) : "—"} du CA), après ${eur(yearRow.charges)} de charges enregistrées.`,
      yearRow.beneficeBrut >= 0 ? "positive" : "warning",
      94,
    );
  }
  if (projection && projection.margeDisponible !== 0 && projection.caToDate > 0) {
    add(
      "marge-dispo",
      "Budget",
      `Marge disponible à date : ${eur(projection.margeDisponible)} sur ${projection.monthsObserved} mois observés.`,
      projection.margeDisponible >= 0 ? "positive" : "warning",
      82,
    );
  }

  // ---- Charges ----
  const cy = charges?.years.find((c) => c.year === year) ?? null;
  if (cy && cy.total > 0) {
    add(
      "charges-mix",
      "Charges",
      `Charges ${year} : ${eur(cy.total)} dont ${eur(cy.fixe)} de fixes et ${eur(cy.variable)} de variables.`,
      "neutral",
      86,
    );
    if (cy.weightPct != null) {
      add(
        "charges-poids",
        "Charges",
        `Les charges représentent ${pct(cy.weightPct)} du CA ${year}.`,
        cy.weightPct <= 45 ? "positive" : "warning",
        84,
      );
    }
    if (cy.monthlyAverage > 0) {
      add("charges-mensuel", "Charges", `Coût de fonctionnement moyen observé : ${eur(cy.monthlyAverage)} par mois.`, "neutral", 70);
    }
  }
  if (charges && charges.unclassifiedCount > 0) {
    add(
      "charges-a-classer",
      "Charges",
      `${charges.unclassifiedCount} charges (${eur(charges.unclassifiedAmount)}) restent à classer : le poids réel fixe/variable est sous-estimé.`,
      "warning",
      76,
    );
  }
  const topCat = charges?.categories.filter((c) => c.charge_class !== "a_classer")[0] ?? null;
  if (topCat && topCat.total > 0) {
    add("charges-top", "Charges", `Premier poste de dépense toutes années : ${topCat.label} (${eur(topCat.total)}).`, "neutral", 66);
  }
  const catYearEvol = charges?.categories
    .map((c) => ({ label: c.label, y: c.years.find((yy) => yy.year === year) }))
    .filter((c) => c.y && c.y.evolutionPct != null && c.y.total > 0)
    .sort((a, b) => (b.y!.evolutionPct ?? 0) - (a.y!.evolutionPct ?? 0))[0];
  if (catYearEvol && (catYearEvol.y!.evolutionPct ?? 0) > 15) {
    add(
      "charges-derive",
      "Charges",
      `${catYearEvol.label} progresse de ${pct(catYearEvol.y!.evolutionPct!)} en ${year} (${eur(catYearEvol.y!.total)}) — poste à arbitrer.`,
      "warning",
      78,
    );
  }

  // ---- Rentabilité / heures ----
  if (hours && hours.hours > 0 && k.caYear > 0) {
    const rate = k.caYear / hours.hours;
    add(
      "taux-reel",
      "Rentabilité",
      `Taux horaire réel ${year} : ${eur(rate)}/h sur ${hrs(hours.hours)} (${hours.sourceLabel}).`,
      settings.target_hourly_rate > 0 ? (rate >= settings.target_hourly_rate ? "positive" : "warning") : "neutral",
      92,
    );
    if (settings.target_hourly_rate > 0) {
      const gap = rate - settings.target_hourly_rate;
      add(
        "taux-cible",
        "Rentabilité",
        gap >= 0
          ? `La cible de ${eur(settings.target_hourly_rate)}/h est dépassée de ${eur(gap)}/h.`
          : `Il manque ${eur(-gap)}/h pour atteindre la cible de ${eur(settings.target_hourly_rate)}/h.`,
        gap >= 0 ? "positive" : "warning",
        91,
      );
    }
  }
  if (hours && hours.vendues > 0 && hours.hours > 0) {
    const ecart = hours.ecart;
    add(
      "ecart-heures",
      "Travaux",
      Math.abs(ecart) < 1
        ? `Heures vendues et heures réalisées coïncident (${hrs(hours.vendues)}) : la facturation reflète le temps passé.`
        : ecart > 0
          ? `${hrs(ecart)} vendues ne sont pas couvertes par du temps réel identifié — vérifier la traçabilité terrain.`
          : `${hrs(-ecart)} réalisées au-delà du temps vendu — temps non facturé.`,
      Math.abs(ecart) < 1 ? "positive" : "warning",
      85,
    );
  }
  if (k.totalHours > 0 && k.workedDays > 0) {
    add("charge-jour", "Travaux", `Volume facturé : ${hrs(k.totalHours)} sur ${k.workedDays} jours d'activité (${(k.totalHours / k.workedDays).toFixed(1)} h/jour).`, "neutral", 60);
  }
  if (k.panierMoyen > 0) {
    add("panier", "Économique", `Panier moyen par prestation facturée : ${eur(k.panierMoyen)}.`, "neutral", 64);
  }
  if (k.tjm > 0) {
    add("tjm", "Économique", `Taux journalier moyen réalisé : ${eur(k.tjm)} par jour d'activité.`, "neutral", 58);
  }

  // ---- Clients ----
  const withCa = portfolio.filter((p) => p.caYear > 0).sort((a, b) => b.caYear - a.caYear);
  if (withCa.length > 0 && k.caYear > 0) {
    const top = withCa[0];
    add("client-top", "Clients", `Premier client ${year} : ${top.name} (${eur(top.caYear)}, ${pct((top.caYear / k.caYear) * 100)} du CA).`, "neutral", 87);
    const top5 = withCa.slice(0, 5).reduce((s, p) => s + p.caYear, 0);
    add(
      "client-concentration",
      "Clients",
      `Les 5 premiers clients pèsent ${pct((top5 / k.caYear) * 100)} du CA ${year} sur ${withCa.length} clients facturés.`,
      top5 / k.caYear > 0.5 ? "warning" : "positive",
      83,
    );
  }
  const lowProfit = portfolio.filter(
    (p) => p.rentabilite != null && settings.target_hourly_rate > 0 && p.rentabilite < settings.target_hourly_rate * 0.75 && p.hours >= 10,
  );
  if (lowProfit.length > 0) {
    add(
      "clients-peu-rentables",
      "Rentabilité",
      `${lowProfit.length} client${lowProfit.length > 1 ? "s" : ""} ≥ 10 h facturé${lowProfit.length > 1 ? "s" : ""} sous 75 % de la cible horaire — tarifs à revoir.`,
      "warning",
      89,
    );
  }
  const bestRate = portfolio
    .filter((p) => p.rentabilite != null && p.hours >= 10)
    .sort((a, b) => (b.rentabilite ?? 0) - (a.rentabilite ?? 0))[0];
  if (bestRate) {
    add("client-best-rate", "Rentabilité", `Meilleure rentabilité horaire : ${bestRate.name} à ${eur(bestRate.rentabilite!)}/h sur ${hrs(bestRate.hours)}.`, "positive", 68);
  }
  const noHours = portfolio.filter((p) => p.caYear > 0 && p.hours <= 0).length;
  if (noHours > 0) {
    add("clients-sans-heures", "Travaux", `${noHours} clients facturés en ${year} sans aucune heure identifiée : leur rentabilité reste non calculable.`, "warning", 72);
  }

  // ---- Opportunités commerciales ----
  if (opportunities && opportunities.pendingValue + opportunities.acceptedValue > 0) {
    add(
      "opportunites",
      "Opportunités",
      `Pipeline commercial : ${eur(opportunities.pendingValue)} en attente et ${eur(opportunities.acceptedValue)} acceptés à planifier.`,
      "positive",
      81,
    );
  }
  if (opportunities && opportunities.invoicedCa > 0) {
    add("opportunites-ca", "Opportunités", `${eur(opportunities.invoicedCa)} de CA déjà généré par les recommandations facturées.`, "positive", 62);
  }

  // ---- Investissement ----
  if (cy && cy.fixe > 0 && k.caYear > 0) {
    const seuil = cy.fixe;
    add(
      "investissement",
      "Investissement",
      `Structure de coûts fixes de ${eur(seuil)} en ${year} : chaque euro de CA au-delà finance directement la capacité d'investissement.`,
      "neutral",
      56,
    );
  }
  if (annual.length >= 3) {
    const last3 = annual.slice(0, 3);
    const avg = last3.reduce((s, a) => s + a.caHt, 0) / last3.length;
    add("historique", "Économique", `Moyenne de CA sur les ${last3.length} derniers exercices : ${eur(avg)}.`, "neutral", 54);
  }

  return out.sort((a, b) => b.weight - a.weight);
}