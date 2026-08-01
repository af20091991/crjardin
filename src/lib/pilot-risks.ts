// Détection automatique des risques (Pilot Pro V2.0).
//
// Ce moteur NE CRÉE AUCUNE DONNÉE : il lit des valeurs déjà calculées par les
// moteurs existants (synthèse annuelle, rentabilité client/prestation, charges,
// contrats CEEV, taux horaire) et signale uniquement ce que les données
// permettent réellement d'affirmer. Chaque risque porte ses sources, son mode
// de calcul et ses limites.

import type { AnnualRow } from "@/lib/pilot-annual";
import type { ClientProfitability } from "@/lib/pilot-client-profitability";
import type { ServiceProfitability } from "@/lib/pilot-service-profitability";
import type { CeevContract } from "@/lib/ceev";
import { renewalAnalysis } from "@/lib/ceev";
import { getThresholds } from "@/lib/pilot-thresholds";

export type RiskSeverity = "critique" | "eleve" | "modere";

export const RISK_SEVERITY_META: Record<RiskSeverity, { label: string; badge: string }> = {
  critique: { label: "Critique", badge: "border-red-200 bg-red-50 text-red-700" },
  eleve: { label: "Élevé", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  modere: { label: "Modéré", badge: "border-sky-200 bg-sky-50 text-sky-700" },
};

export interface PilotRisk {
  key: string;
  title: string;
  severity: RiskSeverity;
  /** Pourquoi ce risque est signalé, en langage métier. */
  why: string;
  /** Comment le chiffre a été obtenu (formule lisible). */
  calc: string;
  /** Données réellement utilisées. */
  sources: string[];
  /** Ce que le calcul ne dit pas. */
  limits: string;
  action: string;
  impactEuro: number | null;
  impactLabel: string;
  to: string;
  weight: number;
}

export interface RiskInput {
  year: number;
  /** Synthèse annuelle (mode courant) déjà calculée par `annualSummary`. */
  annual: AnnualRow[];
  clients: ClientProfitability[];
  services: ServiceProfitability[];
  ceev: CeevContract[];
  /** CA de l'exercice et de N-1 sur le même périmètre (KPI existants). */
  caYear: number;
  caPrevYear: number;
  /** Taux horaire réel résolu (0 si inconnu) et cible paramétrée. */
  tauxHoraireReel: number;
  targetHourlyRate: number;
}

function pct(a: number, b: number): number | null {
  if (b <= 0) return null;
  return ((a - b) / b) * 100;
}

export function buildRisks(input: RiskInput): PilotRisk[] {
  const t = getThresholds();
  const out: PilotRisk[] = [];
  const cur = input.annual.find((a) => a.year === input.year) ?? null;
  const prev = input.annual.find((a) => a.year === input.year - 1) ?? null;

  // 1 — Dépendance commerciale : poids du premier client dans le CA de l'exercice.
  const byCa = [...input.clients].filter((c) => c.caYear > 0).sort((a, b) => b.caYear - a.caYear);
  const totalCa = byCa.reduce((s, c) => s + c.caYear, 0);
  if (totalCa > 0 && byCa.length > 0) {
    const top = byCa[0];
    const share = (top.caYear / totalCa) * 100;
    const top3 = byCa.slice(0, 3).reduce((s, c) => s + c.caYear, 0);
    const share3 = (top3 / totalCa) * 100;
    if (share >= 20 || share3 >= 50) {
      out.push({
        key: `risk:dependance`,
        title: `Dépendance commerciale : ${top.name} représente ${share.toFixed(0)} % du chiffre d'affaires`,
        severity: share >= 30 ? "critique" : "eleve",
        why: `La perte de ce client amputerait directement le chiffre d'affaires de l'exercice. Les 3 premiers clients pèsent ${share3.toFixed(0)} %.`,
        calc: `CA ${top.name} ÷ CA total clients identifiés de l'exercice`,
        sources: ["Lignes CA rattachées aux clients (exercice en cours)"],
        limits: "Les lignes CA sans client rattaché ne sont pas comptées dans ce poids.",
        action: "Sécuriser ce client (contrat) et développer 2 à 3 clients de taille comparable.",
        impactEuro: top.caYear,
        impactLabel: "chiffre d'affaires exposé sur un seul client",
        to: "/pilot/clients",
        weight: 60 + Math.min(35, share),
      });
    }
  }

  // 2 — Dégradation de la marge d'un exercice à l'autre.
  if (cur?.margePct != null && prev?.margePct != null) {
    const delta = cur.margePct - prev.margePct;
    if (delta <= -3) {
      out.push({
        key: "risk:marge",
        title: `Marge en recul de ${Math.abs(delta).toFixed(1)} points par rapport à ${prev.year}`,
        severity: cur.margePct < t.margeMin ? "critique" : "eleve",
        why: `La marge brute passe de ${prev.margePct.toFixed(1)} % à ${cur.margePct.toFixed(1)} % : les charges progressent plus vite que le chiffre d'affaires.`,
        calc: "(CA HT − charges d'exploitation) ÷ CA HT, comparé à l'exercice précédent",
        sources: ["Lignes CA (ventes)", "Charges enregistrées hors investissements"],
        limits: "Les charges non encore saisies sur l'exercice en cours abaissent artificiellement l'écart.",
        action: "Identifier les postes de charges en hausse et réviser les prix des prestations concernées.",
        impactEuro: (Math.abs(delta) / 100) * cur.caHt,
        impactLabel: "marge perdue à chiffre d'affaires constant",
        to: "/pilot/charges",
        weight: 70 + Math.min(25, Math.abs(delta) * 2),
      });
    }
  }

  // 3 — Charges qui progressent plus vite que le chiffre d'affaires.
  if (cur && prev) {
    const evoCharges = pct(cur.charges, prev.charges);
    const evoCa = pct(cur.caHt, prev.caHt);
    if (evoCharges != null && evoCa != null && evoCharges - evoCa >= 10) {
      out.push({
        key: "risk:charges",
        title: `Charges +${evoCharges.toFixed(0)} % contre ${evoCa >= 0 ? "+" : ""}${evoCa.toFixed(0)} % de chiffre d'affaires`,
        severity: "eleve",
        why: "La structure de coûts progresse plus vite que l'activité : le bénéfice se contracte même si le chiffre d'affaires augmente.",
        calc: "Évolution des charges de l'exercice vs N-1, comparée à l'évolution du CA",
        sources: ["Charges enregistrées (hors investissements)", "Lignes CA (ventes)"],
        limits: "Les exercices partiellement saisis rendent la comparaison incomplète.",
        action: "Passer en revue les charges fixes et renégocier les postes en dérive.",
        impactEuro: cur.charges - prev.charges,
        impactLabel: "charges supplémentaires par rapport à l'exercice précédent",
        to: "/pilot/charges",
        weight: 62,
      });
    }
  }

  // 4 — Activité en repli sur le même périmètre que les KPI affichés.
  const evoActivite = pct(input.caYear, input.caPrevYear);
  if (evoActivite != null && evoActivite <= -10) {
    out.push({
      key: "risk:activite",
      title: `Activité en repli de ${Math.abs(evoActivite).toFixed(0)} % par rapport à l'exercice précédent`,
      severity: evoActivite <= -20 ? "critique" : "eleve",
      why: "Le chiffre d'affaires constaté est inférieur à celui de l'exercice précédent sur le même périmètre.",
      calc: "CA de l'exercice ÷ CA de l'exercice précédent − 1 (mode d'affichage en cours)",
      sources: ["Lignes CA (ventes)"],
      limits: "En mode réel, seules les périodes échues sont comparées : un retard de saisie accentue le repli.",
      action: "Relancer les clients sans activité récente et sécuriser les contrats d'entretien.",
      impactEuro: input.caPrevYear - input.caYear,
      impactLabel: "chiffre d'affaires manquant par rapport à N-1",
      to: "/pilot/ca",
      weight: 68,
    });
  }

  // 5 — Contrats d'entretien non reconduits (perte récurrente).
  const { notRenewed } = renewalAnalysis(input.ceev, input.year - 1, input.year);
  if (notRenewed.length > 0) {
    const amount = notRenewed.reduce((s, c) => s + c.pv_ht, 0);
    out.push({
      key: "risk:ceev",
      title: `${notRenewed.length} contrat(s) d'entretien non reconduit(s) en ${input.year}`,
      severity: amount > 0 ? "eleve" : "modere",
      why: "Ces contrats étaient présents l'exercice précédent et n'apparaissent pas sur l'exercice en cours : le chiffre d'affaires récurrent est menacé.",
      calc: "Contrats CEEV de N-1 absents de la liste des contrats de l'exercice",
      sources: ["Contrats CEEV importés"],
      limits: "Un contrat non encore importé pour l'exercice apparaît à tort comme non reconduit.",
      action: "Confirmer la reconduction de chaque contrat ou acter la perte.",
      impactEuro: amount,
      impactLabel: "chiffre d'affaires récurrent en jeu",
      to: "/pilot/ceev",
      weight: 64,
    });
  }

  // 6 — Taux horaire réel sous la cible (rentabilité structurelle).
  if (input.tauxHoraireReel > 0 && input.targetHourlyRate > 0 && input.tauxHoraireReel < input.targetHourlyRate) {
    const ecart = input.targetHourlyRate - input.tauxHoraireReel;
    out.push({
      key: "risk:taux",
      title: `Taux horaire réel inférieur de ${ecart.toFixed(0)} €/h à la cible`,
      severity: input.tauxHoraireReel < input.targetHourlyRate * t.clientSurveillerRatio ? "critique" : "eleve",
      why: `Le taux horaire réellement obtenu (${input.tauxHoraireReel.toFixed(0)} €/h) est en dessous du seuil de rentabilité paramétré (${input.targetHourlyRate.toFixed(0)} €/h).`,
      calc: "CA de l'exercice ÷ heures réelles retenues, comparé au taux horaire cible",
      sources: ["Lignes CA (ventes)", "Heures confirmées et heures historiques"],
      limits: "Les interventions sans heures renseignées ne sont pas prises en compte : le taux réel peut être surévalué.",
      action: "Réviser les prix des prestations les moins rentables ou réduire le temps passé.",
      impactEuro: null,
      impactLabel: "rentabilité horaire sous la cible",
      to: "/pilot/taux",
      weight: 66,
    });
  }

  // 7 — Prestations déficitaires : temps réel supérieur au temps vendu.
  const derive = input.services.filter(
    (s) => s.hoursBasis === "reelles" && s.heuresVendues > 0 && s.heuresReelles > s.heuresVendues * 1.15,
  );
  if (derive.length > 0) {
    const worst = [...derive].sort(
      (a, b) => b.heuresReelles - b.heuresVendues - (a.heuresReelles - a.heuresVendues),
    )[0];
    out.push({
      key: "risk:derive-temps",
      title: `Temps passé supérieur au temps vendu sur ${derive.length} prestation(s)`,
      severity: "modere",
      why: `Sur « ${worst.prestation} », ${worst.heuresReelles.toFixed(0)} h ont été réalisées pour ${worst.heuresVendues.toFixed(0)} h vendues.`,
      calc: "Heures réelles du ledger ÷ heures vendues des lignes CA, par prestation",
      sources: ["Heures réelles consolidées", "Heures vendues des lignes CA"],
      limits: "Seules les prestations dont les heures réelles sont connues sont comparées.",
      action: "Réévaluer le temps facturé de ces prestations ou revoir leur organisation.",
      impactEuro:
        input.targetHourlyRate > 0
          ? (worst.heuresReelles - worst.heuresVendues) * input.targetHourlyRate
          : null,
      impactLabel: "temps non facturé valorisé au taux cible",
      to: "/pilot/prestations",
      weight: 55,
    });
  }

  // 8 — Clients chronophages : rentabilité horaire nettement sous la cible.
  const chronophages = input.clients.filter((c) => c.classe === "chronophage" && c.caYear > 0);
  if (chronophages.length > 0) {
    const worst = [...chronophages].sort((a, b) => (a.tauxHoraire ?? 0) - (b.tauxHoraire ?? 0))[0];
    out.push({
      key: "risk:chronophages",
      title: `${chronophages.length} client(s) chronophage(s) sur l'exercice`,
      severity: "modere",
      why: `« ${worst.name} » ressort à ${worst.tauxHoraire ? `${worst.tauxHoraire.toFixed(0)} €/h` : "un taux horaire inconnu"} : le temps consommé n'est pas couvert par le prix pratiqué.`,
      calc: "CA du client ÷ heures réelles retenues, comparé au taux horaire cible",
      sources: ["Lignes CA rattachées au client", "Heures réelles consolidées"],
      limits: "Un client dont les heures sont partiellement saisies peut être classé à tort.",
      action: "Ajuster le prix, réduire le temps passé ou arbitrer la poursuite de la relation.",
      impactEuro: null,
      impactLabel: "marge dégradée sur ces clients",
      to: "/pilot/clients",
      weight: 52,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}