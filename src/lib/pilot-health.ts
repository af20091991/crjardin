import type { Kpis, PilotSettings } from "@/lib/pilot";
import type { Goal } from "@/lib/pilot-goals";
import type { ChargesAnalysis } from "@/lib/pilot-charges";
import type { AnnualRow } from "@/lib/pilot-annual";
import { getThresholds, type PilotThresholds } from "@/lib/pilot-thresholds";

/**
 * Score de santé pragmatique Pilot Pro.
 *
 * 4 thématiques seulement, chacune calculée à partir de données réellement
 * présentes. Un axe sans donnée exploitable vaut `null` : il est exclu du
 * calcul et affiché « données insuffisantes » plutôt que noté 0.
 *
 * Moteur unique : `pragmaticHealth()` est la seule fonction qui calcule un
 * score de santé dans l'application. Toute surface qui affiche un score de
 * santé doit l'appeler — aucun recalcul local, aucune divergence possible.
 * Le bénéfice/la marge proviennent exclusivement de `annualSummary()`
 * (src/lib/pilot-annual.ts), seule source de vérité du bénéfice.
 */
export type HealthTheme = "financiere" | "commerciale" | "activite" | "objectifs";

export const HEALTH_THEME_META: Record<HealthTheme, { label: string; question: string; color: string }> = {
  financiere: { label: "Santé financière", question: "Est-ce que je gagne de l'argent ?", color: "#4F8E33" },
  commerciale: { label: "Santé commerciale", question: "Est-ce que je vends assez, et à qui ?", color: "#EE8627" },
  activite: { label: "Santé d'activité", question: "Est-ce que mon temps est bien employé ?", color: "#2E8CCC" },
  objectifs: { label: "Objectifs", question: "Est-ce que j'avance sur mes priorités ?", color: "#9333EA" },
};

export interface ThemeScore {
  theme: HealthTheme;
  /** 0-100, ou null si données insuffisantes. */
  score: number | null;
  reason: string;
  details: { label: string; value: string; ok: boolean | null; origin: string; why: string }[];
}

export interface PragmaticHealth {
  score: number | null;
  level: "solide" | "correct" | "fragile" | "critique" | "inconnu";
  themes: ThemeScore[];
  interpretation: string;
  actions: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const pct = (n: number) => `${n.toFixed(0)} %`;
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Interpolation linéaire décroissante : 100 tant que value <= good, 0 dès que value >= bad. */
function scoreDownward(value: number, good: number, bad: number): number {
  if (bad === good) return value <= good ? 100 : 0;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(100 - ((value - good) / (bad - good)) * 100);
}

/** Interpolation linéaire croissante : 0 tant que value <= bad, 100 dès que value >= good. */
function scoreUpward(value: number, bad: number, good: number): number {
  if (good === bad) return value >= good ? 100 : 0;
  if (value <= bad) return 0;
  if (value >= good) return 100;
  return clamp(((value - bad) / (good - bad)) * 100);
}

/**
 * Score de marge nette (0-100) à partir de la marge (%) d'un exercice,
 * selon les seuils TPE paysage (`pilot-thresholds.ts`). Exporté pour être
 * réutilisé tel quel par tout affichage d'évolution de la marge (page Santé,
 * vue annuelle) — aucun autre calcul de score de marge ne doit exister.
 */
export function margeHealthScore(margePct: number | null, thresholds: PilotThresholds = getThresholds()): number | null {
  if (margePct == null) return null;
  return Math.round(scoreUpward(margePct, 0, thresholds.margeSaineMin));
}

/** Score du poids des charges d'exploitation / CA (0-100). */
export function chargesWeightHealthScore(weightPct: number | null, thresholds: PilotThresholds = getThresholds()): number | null {
  if (weightPct == null) return null;
  return Math.round(scoreDownward(weightPct, thresholds.poidsChargesSain, thresholds.poidsChargesAlerte));
}

/** Score du taux horaire facturé (0-100), entre seuil d'alerte et cible basse. */
export function tauxHoraireHealthScore(taux: number, thresholds: PilotThresholds = getThresholds()): number {
  return Math.round(scoreUpward(taux, thresholds.tauxHoraireAlerte, thresholds.tauxHoraireCibleMin));
}

/** Score de concentration client (0-100) : sain si le 1er client < seuil sain. */
export function concentrationHealthScore(topClientSharePct: number, thresholds: PilotThresholds = getThresholds()): number {
  return Math.round(scoreDownward(topClientSharePct, thresholds.concentrationClientSaine, thresholds.concentrationClientAlerte));
}

export function pragmaticHealth(params: {
  k: Kpis;
  /** Ligne de l'exercice courant issue de `annualSummary()` — source unique du bénéfice/de la marge. */
  annual: AnnualRow | null;
  settings: PilotSettings;
  goals: Goal[];
  charges?: ChargesAnalysis | null;
  dormantClients?: number;
  activeClients?: number;
  /** Part du CA du 1er client (%), issue de `clientStats()` — pour la concentration client. */
  topClientSharePct?: number | null;
  thresholds?: PilotThresholds;
  /** Date de référence injectable : aucun moteur critique ne lit l'horloge. */
  now?: Date;
}): PragmaticHealth {
  const {
    k, annual, settings, goals, dormantClients = 0, activeClients = 0,
    topClientSharePct = null,
  } = params;
  const thresholds = params.thresholds ?? getThresholds();
  const themes: ThemeScore[] = [];

  // ---- 1. Financière : marge, charges / CA, bénéfice (source unique : annualSummary)
  {
    const details: ThemeScore["details"] = [];
    const parts: number[] = [];
    if (annual && annual.caHt > 0) {
      const margeScore = margeHealthScore(annual.margePct, thresholds);
      if (margeScore != null) {
        parts.push(margeScore);
        details.push({
          label: "Marge nette",
          value: annual.margePct != null ? pct(annual.margePct) : "—",
          ok: annual.margePct != null ? annual.margePct >= thresholds.margeSaineMin : null,
          origin: "annualSummary() — CA HT − charges d'exploitation de l'exercice",
          why: `Repère TPE paysage : marge saine ${thresholds.margeSaineMin}–${thresholds.margeSaineMax} % du CA. Décide s'il faut revoir les prix ou les charges.`,
        });
      }
      details.push({
        label: "Bénéfice brut",
        value: eur(annual.beneficeBrut),
        ok: annual.beneficeBrut > 0,
        origin: "annualSummary() — CA HT − charges d'exploitation, hors investissements",
        why: "Montant réellement disponible avant investissement.",
      });
      const poids = annual.caHt > 0 ? (annual.charges / annual.caHt) * 100 : null;
      const poidsScore = chargesWeightHealthScore(poids, thresholds);
      if (poidsScore != null) {
        parts.push(poidsScore);
        details.push({
          label: "Poids des charges",
          value: pct(poids as number),
          ok: (poids as number) <= thresholds.poidsChargesSain,
          origin: "annualSummary() — charges d'exploitation de l'exercice / CA HT",
          why: `Sain jusqu'à ${thresholds.poidsChargesSain} % du CA ; alerte au-delà de ${thresholds.poidsChargesAlerte} %.`,
        });
      }
    }
    themes.push({
      theme: "financiere",
      score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      reason: parts.length ? "Marge, bénéfice et poids des charges de l'exercice (annualSummary)." : "Aucun CA enregistré sur l'exercice.",
      details,
    });
  }

  // ---- 2. Commerciale : progression CA, panier moyen, clients actifs / dormants, concentration
  {
    const details: ThemeScore["details"] = [];
    const parts: number[] = [];
    if (k.caPrevYTD > 0) {
      parts.push(clamp(50 + k.progression * 2));
      details.push({ label: "Progression vs N-1", value: pct(k.progression), ok: k.progression >= 0, origin: "CA cumulé à date, exercices N et N-1", why: "Décide s'il faut relancer la prospection." });
    }
    if (activeClients + dormantClients > 0) {
      const fidele = (activeClients / (activeClients + dormantClients)) * 100;
      parts.push(clamp(fidele));
      details.push({ label: "Clients actifs", value: `${activeClients} / ${activeClients + dormantClients}`, ok: fidele >= 60, origin: "Référentiel clients + dernière facturation", why: "Mesure la vitalité du portefeuille." });
      details.push({ label: "Clients dormants", value: String(dormantClients), ok: dormantClients === 0, origin: "Clients sans facturation récente", why: "CA le plus rapide à récupérer par relance." });
    }
    if (topClientSharePct != null) {
      parts.push(concentrationHealthScore(topClientSharePct, thresholds));
      details.push({
        label: "Concentration 1er client",
        value: pct(topClientSharePct),
        ok: topClientSharePct < thresholds.concentrationClientSaine,
        origin: "clientStats() — part du 1er client dans le CA",
        why: `Sain sous ${thresholds.concentrationClientSaine} % du CA ; alerte au-delà de ${thresholds.concentrationClientAlerte} %. Décide s'il faut diversifier la clientèle.`,
      });
    }
    if (k.panierMoyen > 0) details.push({ label: "Panier moyen", value: eur(k.panierMoyen), ok: null, origin: "CA / nombre de prestations facturées", why: "Sert à fixer un montant minimum de déplacement." });
    themes.push({
      theme: "commerciale",
      score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      reason: parts.length ? "Dynamique du CA, vitalité du portefeuille et concentration client." : "Pas d'historique N-1 ni de portefeuille exploitable.",
      details,
    });
  }

  // ---- 3. Activité : taux horaire réel vs cible, volume
  {
    const details: ThemeScore["details"] = [];
    const parts: number[] = [];
    const cible = settings.target_hourly_rate ?? 0;
    if (k.tauxHoraireReel > 0) {
      parts.push(tauxHoraireHealthScore(k.tauxHoraireReel, thresholds));
      details.push({
        label: "Taux horaire réel",
        value: `${k.tauxHoraireReel.toFixed(0)} €/h`,
        ok: k.tauxHoraireReel >= (cible > 0 ? cible : thresholds.tauxHoraireCibleMin),
        origin: "CA / heures réellement consommées",
        why: `Repère TPE paysage : taux cible ${thresholds.tauxHoraireCibleMin}–${thresholds.tauxHoraireCibleMax} €/h, alerte sous ${thresholds.tauxHoraireAlerte} €/h.`,
      });
    }
    if (k.tauxHoraireVendu > 0) {
      details.push({ label: "Taux horaire vendu", value: `${k.tauxHoraireVendu.toFixed(0)} €/h`, ok: k.tauxHoraireVendu >= (cible > 0 ? cible : thresholds.tauxHoraireCibleMin), origin: "CA / heures facturées", why: "Base de la grille tarifaire des devis." });
      if (!(k.tauxHoraireReel > 0)) parts.push(tauxHoraireHealthScore(k.tauxHoraireVendu, thresholds));
    }
    if (k.nbEntries > 0) details.push({ label: "Lignes de vente", value: String(k.nbEntries), ok: null, origin: "pilot_ca_entries", why: "Volume d'activité facturée sur l'exercice." });
    themes.push({
      theme: "activite",
      score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      reason: parts.length
        ? "Comparaison du taux horaire obtenu avec les repères métier (cible et seuil d'alerte)."
        : "Aucune heure facturée ou confirmée sur l'exercice.",
      details,
    });
  }

  // ---- 4. Objectifs : avancement des objectifs stratégiques
  {
    const actifs = goals.filter((g) => g.status !== "abandonne");
    const done = actifs.filter((g) => g.status === "termine").length;
    const today = (params.now ?? new Date()).toISOString().slice(0, 10);
    const retard = actifs.filter((g) => g.status === "en_cours" && g.deadline && g.deadline < today).length;
    const details: ThemeScore["details"] = actifs.length
      ? [
          { label: "Objectifs atteints", value: `${done} / ${actifs.length}`, ok: done > 0, origin: "pilot_goals", why: "Mesure l'avancement réel du plan." },
          { label: "Objectifs en retard", value: String(retard), ok: retard === 0, origin: "pilot_goals — échéances dépassées", why: "Décide s'il faut replanifier ou abandonner." },
        ]
      : [];
    const base = actifs.length ? (done / actifs.length) * 100 - retard * 5 : null;
    themes.push({
      theme: "objectifs",
      score: base == null ? null : Math.round(clamp(base)),
      reason: actifs.length ? "Objectifs terminés, pénalisés par les retards." : "Aucun objectif enregistré.",
      details,
    });
  }

  const scored = themes.filter((t) => t.score != null) as (ThemeScore & { score: number })[];
  const score = scored.length ? Math.round(scored.reduce((s, t) => s + t.score, 0) / scored.length) : null;
  const level: PragmaticHealth["level"] =
    score == null ? "inconnu" : score >= 75 ? "solide" : score >= 55 ? "correct" : score >= 35 ? "fragile" : "critique";

  const weakest = scored.slice().sort((a, b) => a.score - b.score)[0];
  const interpretation =
    score == null
      ? "Pas assez de données pour évaluer la santé de l'entreprise."
      : level === "solide"
        ? "L'entreprise est saine : marge, dynamique commerciale et objectifs sont alignés. L'enjeu est de tenir le cap."
        : level === "correct"
          ? `Situation correcte. Le point le plus faible est « ${weakest ? HEALTH_THEME_META[weakest.theme].label : "—"} », c'est là qu'un effort produira le plus d'effet.`
          : level === "fragile"
            ? `Situation fragile : plusieurs axes décrochent, à commencer par « ${weakest ? HEALTH_THEME_META[weakest.theme].label : "—"} ». Une correction est nécessaire ce trimestre.`
            : "Situation critique : la rentabilité et/ou l'activité ne couvrent pas les besoins. Une action immédiate est requise.";

  const actions: string[] = [];
  if (annual && annual.margePct != null && annual.margePct < thresholds.margeSaineMin)
    actions.push("Remonter la marge : revoir les prix des prestations les moins rentables ou réduire les charges d'exploitation.");
  if (dormantClients > 0) actions.push(`Relancer les ${dormantClients} client(s) dormant(s) : c'est le CA le plus rapide à récupérer.`);
  if (topClientSharePct != null && topClientSharePct > thresholds.concentrationClientAlerte)
    actions.push("Diversifier la clientèle : le 1er client pèse trop lourd dans le CA.");
  if (k.tauxHoraireReel > 0 && k.tauxHoraireReel < thresholds.tauxHoraireAlerte)
    actions.push("Le taux horaire réel est sous le seuil d'alerte : ajuster les devis ou le temps passé sur les chantiers concernés.");
  if (themes.find((t) => t.theme === "objectifs")?.details.some((d) => d.label === "Objectifs en retard" && d.value !== "0"))
    actions.push("Traiter les objectifs en retard ou repousser leur échéance pour garder un plan crédible.");
  if (!actions.length && score != null) actions.push("Aucune action corrective urgente : poursuivre le suivi mensuel.");

  return { score, level, themes, interpretation, actions };
}

export const HEALTH_LEVEL_META: Record<PragmaticHealth["level"], { label: string; tone: string; color: string }> = {
  solide: { label: "Solide", tone: "bg-emerald-100 text-emerald-700", color: "#059669" },
  correct: { label: "Correct", tone: "bg-green-100 text-green-700", color: "#4F8E33" },
  fragile: { label: "Fragile", tone: "bg-amber-100 text-amber-700", color: "#EE8627" },
  critique: { label: "Critique", tone: "bg-rose-100 text-rose-700", color: "#DC2626" },
  inconnu: { label: "Données insuffisantes", tone: "bg-slate-100 text-slate-600", color: "#94A3B8" },
};
