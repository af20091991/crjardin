import type { Kpis, PilotSettings } from "@/lib/pilot";
import type { Goal } from "@/lib/pilot-goals";
import type { ChargesAnalysis } from "@/lib/pilot-charges";

/**
 * Score de santé pragmatique Pilot Pro.
 *
 * 4 thématiques seulement, chacune calculée à partir de données réellement
 * présentes. Un axe sans donnée exploitable vaut `null` : il est exclu du
 * calcul et affiché « données insuffisantes » plutôt que noté 0.
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

export function pragmaticHealth(params: {
  k: Kpis;
  settings: PilotSettings;
  goals: Goal[];
  charges?: ChargesAnalysis | null;
  dormantClients?: number;
  activeClients?: number;
}): PragmaticHealth {
  const { k, settings, goals, charges, dormantClients = 0, activeClients = 0 } = params;
  const themes: ThemeScore[] = [];

  // ---- 1. Financière : marge, charges / CA, bénéfice
  {
    const details: ThemeScore["details"] = [];
    const parts: number[] = [];
    if (k.caYear > 0) {
      const margeScore = clamp((k.marge / 30) * 100);
      parts.push(margeScore);
      details.push({ label: "Marge nette", value: pct(k.marge), ok: k.marge >= 20, origin: "CA facturé − charges enregistrées", why: "Indique si l'activité dégage de quoi vivre et investir." });
      details.push({ label: "Bénéfice brut", value: eur(k.benefice), ok: k.benefice > 0, origin: "Suivi CA + module charges", why: "Montant réellement disponible avant investissement." });
      const poids = charges?.years.find((y) => y.year === new Date().getFullYear())?.weightPct ?? null;
      if (poids != null) {
        parts.push(clamp(100 - Math.max(0, poids - 30) * 2));
        details.push({ label: "Poids des charges", value: pct(poids), ok: poids <= 40, origin: "Charges de l'exercice / CA", why: "Au-delà de 40 %, la structure de coûts doit être arbitrée." });
      }
    }
    themes.push({
      theme: "financiere",
      score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      reason: parts.length ? "Marge, bénéfice et poids des charges de l'exercice." : "Aucun CA enregistré sur l'exercice.",
      details,
    });
  }

  // ---- 2. Commerciale : progression CA, panier moyen, clients actifs / dormants
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
    if (k.panierMoyen > 0) details.push({ label: "Panier moyen", value: eur(k.panierMoyen), ok: null, origin: "CA / nombre de prestations facturées", why: "Sert à fixer un montant minimum de déplacement." });
    themes.push({
      theme: "commerciale",
      score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      reason: parts.length ? "Dynamique du CA et vitalité du portefeuille client." : "Pas d'historique N-1 ni de portefeuille exploitable.",
      details,
    });
  }

  // ---- 3. Activité : taux horaire réel vs cible, volume
  {
    const details: ThemeScore["details"] = [];
    const parts: number[] = [];
    const cible = settings.target_hourly_rate ?? 0;
    if (cible > 0 && k.tauxHoraireReel > 0) {
      parts.push(clamp((k.tauxHoraireReel / cible) * 100));
      details.push({ label: "Taux horaire réel", value: `${k.tauxHoraireReel.toFixed(0)} €/h`, ok: k.tauxHoraireReel >= cible, origin: "CA / heures réellement consommées", why: "Vérifie que le prix couvre le temps passé." });
    }
    if (cible > 0 && k.tauxHoraireVendu > 0) {
      details.push({ label: "Taux horaire vendu", value: `${k.tauxHoraireVendu.toFixed(0)} €/h`, ok: k.tauxHoraireVendu >= cible, origin: "CA / heures facturées", why: "Base de la grille tarifaire des devis." });
      if (!(k.tauxHoraireReel > 0)) parts.push(clamp((k.tauxHoraireVendu / cible) * 100));
    }
    if (k.nbEntries > 0) details.push({ label: "Lignes de vente", value: String(k.nbEntries), ok: null, origin: "pilot_ca_entries", why: "Volume d'activité facturée sur l'exercice." });
    themes.push({
      theme: "activite",
      score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      reason: parts.length
        ? "Comparaison du taux horaire obtenu avec le taux horaire cible."
        : "Taux horaire cible non défini ou heures non renseignées.",
      details,
    });
  }

  // ---- 4. Objectifs : avancement des objectifs stratégiques
  {
    const actifs = goals.filter((g) => g.status !== "abandonne");
    const done = actifs.filter((g) => g.status === "termine").length;
    const today = new Date().toISOString().slice(0, 10);
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
  if (k.marge < 20 && k.caYear > 0) actions.push("Remonter la marge : revoir les prix des prestations les moins rentables ou réduire les charges variables.");
  if (dormantClients > 0) actions.push(`Relancer les ${dormantClients} client(s) dormant(s) : c'est le CA le plus rapide à récupérer.`);
  if (settings.target_hourly_rate > 0 && k.tauxHoraireReel > 0 && k.tauxHoraireReel < settings.target_hourly_rate)
    actions.push("Le taux horaire réel est sous la cible : ajuster les devis ou le temps passé sur les chantiers concernés.");
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
