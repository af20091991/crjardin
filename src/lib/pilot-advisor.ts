// Conseiller de gestion (Pilot Pro V2.0).
//
// Répond aux questions de direction les plus fréquentes UNIQUEMENT à partir des
// valeurs déjà calculées par les moteurs existants (synthèse annuelle,
// rentabilité client/prestation, analyse des charges, taux horaire).
// Chaque réponse indique son calcul, ses sources et ses limites. Quand la
// donnée manque, la réponse est explicitement « information insuffisante ».

import type { AnnualRow } from "@/lib/pilot-annual";
import type { ChargesAnalysis } from "@/lib/pilot-charges";
import type { ClientProfitability } from "@/lib/pilot-client-profitability";
import type { ServiceProfitability } from "@/lib/pilot-service-profitability";
import { employerCost } from "@/lib/pilot-remuneration";
import { formatEuro } from "@/lib/pilot";

export type AdvisorVerdict = "favorable" | "prudence" | "defavorable" | "inconnu";

export const ADVISOR_VERDICT_META: Record<AdvisorVerdict, { label: string; badge: string }> = {
  favorable: { label: "Favorable", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  prudence: { label: "Sous conditions", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  defavorable: { label: "Défavorable", badge: "border-red-200 bg-red-50 text-red-700" },
  inconnu: { label: "Donnée insuffisante", badge: "border-border bg-muted text-muted-foreground" },
};

export interface AdvisorAnswer {
  key: string;
  question: string;
  verdict: AdvisorVerdict;
  /** Réponse en une phrase, chiffrée. */
  answer: string;
  calc: string;
  sources: string[];
  limits: string;
  action: string;
  to?: string;
}

export interface AdvisorInput {
  year: number;
  annual: AnnualRow[];
  charges: ChargesAnalysis;
  clients: ClientProfitability[];
  services: ServiceProfitability[];
  tauxHoraireReel: number;
  targetHourlyRate: number;
  /** Salaire net mensuel de référence pour la simulation d'embauche. */
  netMensuelReference?: number;
}

const SRC_CA = "Lignes CA (ventes) enregistrées";
const SRC_CHARGES = "Charges enregistrées hors investissements";

export function buildAdvisorAnswers(input: AdvisorInput): AdvisorAnswer[] {
  const cur = input.annual.find((a) => a.year === input.year) ?? null;
  const prev = input.annual.find((a) => a.year === input.year - 1) ?? null;
  const out: AdvisorAnswer[] = [];

  // 1 — Puis-je embaucher ?
  const net = input.netMensuelReference ?? 1600;
  const coutAnnuel = employerCost(net) * 12;
  if (!cur || cur.caHt <= 0) {
    out.push({
      key: "embauche",
      question: "Puis-je embaucher ?",
      verdict: "inconnu",
      answer: "Aucun chiffre d'affaires exploitable sur l'exercice : la capacité d'embauche ne peut pas être évaluée.",
      calc: "Bénéfice brut de l'exercice comparé au coût entreprise annuel d'un salarié",
      sources: [SRC_CA, SRC_CHARGES],
      limits: "Exercice non renseigné.",
      action: "Compléter les lignes de chiffre d'affaires de l'exercice.",
      to: "/pilot/ca",
    });
  } else {
    const ratio = cur.beneficeBrut / coutAnnuel;
    out.push({
      key: "embauche",
      question: "Puis-je embaucher ?",
      verdict: ratio >= 2 ? "favorable" : ratio >= 1.2 ? "prudence" : "defavorable",
      answer: `Le bénéfice brut de ${cur.year} (${formatEuro(cur.beneficeBrut)}) couvre ${ratio.toFixed(1)} fois le coût entreprise d'un salarié à ${formatEuro(net)} net par mois, soit ${formatEuro(coutAnnuel)} par an.`,
      calc: "Bénéfice brut de l'exercice ÷ (net mensuel × 1,45 × 12)",
      sources: [SRC_CA, SRC_CHARGES, "Règle de coût employeur Pilot Pro (net + 45 %)"],
      limits: "Le calcul ne tient pas compte du chiffre d'affaires supplémentaire que le salarié apporterait, ni de la trésorerie.",
      action: ratio >= 1.2 ? "Sécuriser le carnet de commandes avant d'embaucher." : "Améliorer la marge avant toute embauche.",
      to: "/pilot/simulations",
    });
  }

  // 2 — Mes prix sont-ils suffisants ?
  if (input.tauxHoraireReel <= 0 || input.targetHourlyRate <= 0) {
    out.push({
      key: "prix",
      question: "Mes prix sont-ils suffisants ?",
      verdict: "inconnu",
      answer: "Le taux horaire réel n'est pas calculable : les heures réellement passées ne sont pas suffisamment renseignées.",
      calc: "CA de l'exercice ÷ heures réelles retenues",
      sources: ["Heures confirmées sur interventions", "Heures historiques validées"],
      limits: "Sans heures réelles, seul le taux horaire vendu est disponible.",
      action: "Renseigner les heures réellement passées sur les interventions terminées.",
      to: "/pilot/rapprochement",
    });
  } else {
    const ecart = input.tauxHoraireReel - input.targetHourlyRate;
    out.push({
      key: "prix",
      question: "Mes prix sont-ils suffisants ?",
      verdict: ecart >= 0 ? "favorable" : ecart > -input.targetHourlyRate * 0.15 ? "prudence" : "defavorable",
      answer: `Le taux horaire réel est de ${input.tauxHoraireReel.toFixed(0)} €/h pour une cible de ${input.targetHourlyRate.toFixed(0)} €/h, soit un écart de ${ecart >= 0 ? "+" : ""}${ecart.toFixed(0)} €/h.`,
      calc: "CA de l'exercice ÷ heures réelles retenues, comparé au taux horaire cible paramétré",
      sources: [SRC_CA, "Heures réelles consolidées"],
      limits: "Les interventions sans heures connues sont exclues du calcul.",
      action: ecart >= 0 ? "Maintenir la politique tarifaire actuelle." : "Réviser les prix des prestations les moins rentables.",
      to: "/pilot/taux",
    });
  }

  // 3 — Quels clients développer, lesquels arbitrer ?
  const classes = input.clients.filter((c) => c.caYear > 0);
  const top = [...classes]
    .filter((c) => c.classe === "tres_rentable" || c.classe === "rentable")
    .sort((a, b) => (b.tauxHoraire ?? 0) - (a.tauxHoraire ?? 0))
    .slice(0, 3);
  const bas = classes.filter((c) => c.classe === "chronophage");
  out.push({
    key: "clients",
    question: "Quels clients développer, lesquels arbitrer ?",
    verdict: classes.length === 0 ? "inconnu" : top.length > 0 ? "favorable" : "prudence",
    answer:
      classes.length === 0
        ? "Aucun client ne dispose de données suffisantes pour être classé sur l'exercice."
        : `À développer : ${top.map((c) => c.name).join(", ") || "aucun client classé rentable"}. À arbitrer : ${bas.length > 0 ? bas.map((c) => c.name).slice(0, 3).join(", ") : "aucun client chronophage détecté"}.`,
    calc: "Classement par CA ÷ heures réelles retenues, comparé au taux horaire cible",
    sources: ["Lignes CA rattachées aux clients", "Heures réelles consolidées"],
    limits: "Les clients dont les heures ne sont pas renseignées restent non classés.",
    action: "Prioriser les propositions commerciales sur les clients les plus rentables.",
    to: "/pilot/clients",
  });

  // 4 — Où part mon argent ?
  const catYear = input.charges.categories
    .map((c) => ({
      label: c.label,
      charge_class: c.charge_class,
      total: c.years.find((y) => y.year === input.year)?.total ?? 0,
      evolutionPct: c.years.find((y) => y.year === input.year)?.evolutionPct ?? null,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const yearCharges = input.charges.years.find((y) => y.year === input.year) ?? null;
  out.push({
    key: "charges",
    question: "Où part mon argent ?",
    verdict: catYear.length === 0 ? "inconnu" : "favorable",
    answer:
      catYear.length === 0
        ? "Aucune charge enregistrée sur l'exercice."
        : `Les 3 premiers postes de ${input.year} sont ${catYear
            .slice(0, 3)
            .map((c) => `${c.label} (${formatEuro(c.total)})`)
            .join(", ")} sur un total de ${formatEuro(yearCharges?.total ?? 0)}.`,
    calc: "Somme des charges par catégorie sur l'exercice, hors investissements",
    sources: [SRC_CHARGES, "Catégories de charges paramétrées"],
    limits: `${input.charges.unclassifiedCount} charge(s) restent à classer et ne sont pas ventilées.`,
    action: "Classer les charges restantes puis renégocier le poste le plus lourd.",
    to: "/pilot/charges",
  });

  // 5 — Puis-je investir ?
  if (!cur) {
    out.push({
      key: "invest",
      question: "Puis-je investir cette année ?",
      verdict: "inconnu",
      answer: "Exercice non exploitable : capacité d'investissement inconnue.",
      calc: "Bénéfice brut − investissements déjà engagés sur l'exercice",
      sources: [SRC_CA, SRC_CHARGES],
      limits: "Aucune donnée sur l'exercice.",
      action: "Compléter les données de l'exercice.",
      to: "/pilot/finance",
    });
  } else {
    const dispo = cur.resultatApresInvestissements;
    out.push({
      key: "invest",
      question: "Puis-je investir cette année ?",
      verdict: dispo > 0 ? (dispo > cur.caHt * 0.1 ? "favorable" : "prudence") : "defavorable",
      answer: `Après ${formatEuro(cur.investissements)} déjà investis, il reste ${formatEuro(dispo)} de résultat sur l'exercice ${cur.year}.`,
      calc: "Bénéfice brut de l'exercice − investissements qualifiés de l'exercice",
      sources: [SRC_CA, SRC_CHARGES, "Charges qualifiées comme investissements"],
      limits: "Le résultat n'est pas la trésorerie : les encaissements et échéances ne sont pas suivis ici.",
      action: dispo > 0 ? "Chiffrer l'investissement dans le simulateur avant de décider." : "Reporter l'investissement.",
      to: "/pilot/simulations",
    });
  }

  // 6 — Mon activité progresse-t-elle ?
  if (!cur || !prev || prev.caHt <= 0) {
    out.push({
      key: "progression",
      question: "Mon activité progresse-t-elle ?",
      verdict: "inconnu",
      answer: "Un seul exercice exploitable : aucune comparaison possible.",
      calc: "CA et marge de l'exercice comparés à l'exercice précédent",
      sources: [SRC_CA, SRC_CHARGES],
      limits: "Historique insuffisant.",
      action: "Importer les exercices antérieurs pour disposer d'une tendance.",
      to: "/pilot/finance",
    });
  } else {
    const evo = ((cur.caHt - prev.caHt) / prev.caHt) * 100;
    const dm = cur.margePct != null && prev.margePct != null ? cur.margePct - prev.margePct : null;
    out.push({
      key: "progression",
      question: "Mon activité progresse-t-elle ?",
      verdict: evo >= 0 && (dm == null || dm >= -1) ? "favorable" : evo >= 0 ? "prudence" : "defavorable",
      answer: `Chiffre d'affaires ${evo >= 0 ? "en hausse" : "en baisse"} de ${Math.abs(evo).toFixed(0)} % par rapport à ${prev.year}${dm != null ? `, marge ${dm >= 0 ? "+" : ""}${dm.toFixed(1)} point(s)` : ""}.`,
      calc: "CA de l'exercice ÷ CA de l'exercice précédent − 1, et écart de marge en points",
      sources: [SRC_CA, SRC_CHARGES],
      limits: "En mode réel, seules les périodes échues sont comparées.",
      action: evo >= 0 ? "Consolider la croissance en sécurisant les contrats récurrents." : "Relancer les clients inactifs et sécuriser les contrats.",
      to: "/pilot/ca",
    });
  }

  return out;
}

/** Lecture historique multi-exercices : tendance factuelle, sans extrapolation. */
export interface HistoryTrend {
  years: AnnualRow[];
  caCagrPct: number | null;
  bestYear: AnnualRow | null;
  worstMarginYear: AnnualRow | null;
}

export function buildHistoryTrend(annual: AnnualRow[]): HistoryTrend {
  const years = [...annual].sort((a, b) => a.year - b.year).filter((y) => y.caHt > 0);
  let caCagrPct: number | null = null;
  if (years.length >= 2) {
    const first = years[0];
    const last = years[years.length - 1];
    const n = last.year - first.year;
    if (n > 0 && first.caHt > 0) {
      caCagrPct = (Math.pow(last.caHt / first.caHt, 1 / n) - 1) * 100;
    }
  }
  const withMargin = years.filter((y) => y.margePct != null);
  return {
    years: [...years].reverse(),
    caCagrPct,
    bestYear: years.length > 0 ? years.reduce((a, b) => (b.caHt > a.caHt ? b : a)) : null,
    worstMarginYear:
      withMargin.length > 0
        ? withMargin.reduce((a, b) => ((b.margePct ?? 0) < (a.margePct ?? 0) ? b : a))
        : null,
  };
}