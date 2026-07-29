/**
 * Moteur de recommandations Pilot Pro.
 *
 * Règle : aucune donnée nouvelle, aucune estimation inventée. Chaque
 * recommandation est construite à partir des moteurs déjà existants
 * (rentabilité client, rentabilité prestation, activité client, contrats
 * CEEV, recommandations jardin) et expose systématiquement :
 *  - le constat chiffré (pourquoi),
 *  - les données utilisées (traçabilité des sources),
 *  - l'impact estimé (calculé, jamais deviné ; `null` si non chiffrable),
 *  - l'action concrète et le lien vers l'écran de traitement.
 */
import type { ClientProfitability } from "./pilot-client-profitability";
import type { ServiceProfitability } from "./pilot-service-profitability";
import type { CeevContract } from "./ceev";
import { renewalAnalysis } from "./ceev";

export type RecommendationTheme =
  | "Commercial"
  | "Rentabilité"
  | "Contrats"
  | "Organisation";

export interface PilotRecommendation {
  key: string;
  theme: RecommendationTheme;
  title: string;
  /** Constat chiffré, formulé en langage métier. */
  why: string;
  /** Sources réellement utilisées pour produire la recommandation. */
  sources: string[];
  /** Impact estimé en € (annuel ou potentiel). `null` = non chiffrable. */
  impactEuro: number | null;
  impactLabel: string;
  action: string;
  to: string;
  /** Priorité de tri : plus élevé = plus prioritaire. */
  weight: number;
}

export interface RecommendationInput {
  year: number;
  targetHourlyRate: number;
  clients: ClientProfitability[];
  services: ServiceProfitability[];
  ceevContracts: CeevContract[];
  /** Recommandations acceptées mais non planifiées (montant unitaire connu). */
  acceptedNotPlanned: Array<{ id: string; unit_price: number | null }>;
  /** Clients sans activité depuis plus de 6 mois. */
  clientsARelancer: number;
  /** Clients sans activité depuis plus de 12 mois. */
  clientsDormants: number;
  /** CA moyen par client actif sur l'exercice (sert au potentiel de relance). */
  caMoyenParClient: number;
}

export function buildRecommendations(input: RecommendationInput): PilotRecommendation[] {
  const out: PilotRecommendation[] = [];
  const {
    year,
    targetHourlyRate,
    clients,
    services,
    ceevContracts,
    acceptedNotPlanned,
    clientsARelancer,
    clientsDormants,
    caMoyenParClient,
  } = input;

  // 1 — Recommandations acceptées non planifiées : CA déjà accepté, non encore réalisé.
  if (acceptedNotPlanned.length > 0) {
    const montant = acceptedNotPlanned.reduce((s, r) => s + (Number(r.unit_price) || 0), 0);
    out.push({
      key: "recos-a-planifier",
      theme: "Commercial",
      title: "Planifier les recommandations déjà acceptées",
      why: `${acceptedNotPlanned.length} recommandation(s) acceptée(s) par un client ne sont rattachées à aucune intervention planifiée.`,
      sources: ["Table recommandations (statut « acceptée », sans intervention planifiée)"],
      impactEuro: montant > 0 ? montant : null,
      impactLabel:
        montant > 0
          ? "CA déjà accepté en attente de planification"
          : "Montant non renseigné sur ces recommandations",
      action: "Créer les interventions correspondantes depuis la fiche client.",
      to: "/pilot/focus/recos-a-planifier",
      weight: 100 + acceptedNotPlanned.length,
    });
  }

  // 2 — Clients chronophages : heures réelles connues, taux horaire sous la cible.
  if (targetHourlyRate > 0) {
    const chronophages = clients
      .filter((c) => c.classe === "chronophage" && c.tauxHoraire != null && c.hours > 0)
      .sort((a, b) => b.hours * (targetHourlyRate - (b.tauxHoraire ?? 0)) - a.hours * (targetHourlyRate - (a.tauxHoraire ?? 0)));
    if (chronophages.length > 0) {
      const manqueAGagner = chronophages.reduce(
        (s, c) => s + Math.max(0, targetHourlyRate - (c.tauxHoraire ?? 0)) * c.hours,
        0,
      );
      const top = chronophages[0];
      out.push({
        key: "clients-chronophages",
        theme: "Rentabilité",
        title: "Réviser les tarifs des clients chronophages",
        why: `${chronophages.length} client(s) consomment beaucoup d'heures pour un taux horaire inférieur à la cible de ${Math.round(targetHourlyRate)} €/h — en tête : ${top.name} (${Math.round(top.hours)} h, ${Math.round(top.tauxHoraire ?? 0)} €/h).`,
        sources: [
          "Lignes CA rattachées au client",
          "Heures réelles consolidées (interventions, puis historique)",
          "Taux horaire cible des paramètres Pilot Pro",
        ],
        impactEuro: manqueAGagner > 0 ? manqueAGagner : null,
        impactLabel: "Manque à gagner si ces clients étaient facturés au taux cible",
        action: "Réajuster le prix ou le temps alloué sur les prochains devis de ces clients.",
        to: "/pilot/focus/chronophages",
        weight: 90,
      });
    }
  }

  // 3 — Prestations peu rentables.
  const faibles = services.filter((s) => s.classe === "faible" && s.caYear > 0);
  if (faibles.length > 0 && targetHourlyRate > 0) {
    const impact = faibles.reduce((s, p) => {
      const heures = p.heuresReelles > 0 ? p.heuresReelles : p.heuresVendues;
      if (!heures || p.tauxHoraire == null) return s;
      return s + Math.max(0, targetHourlyRate - p.tauxHoraire) * heures;
    }, 0);
    out.push({
      key: "prestations-faibles",
      theme: "Rentabilité",
      title: "Repositionner les prestations sous la cible",
      why: `${faibles.length} prestation(s) affichent un taux horaire sous la cible — en tête : ${faibles[0].prestation}.`,
      sources: [
        "Lignes CA regroupées par désignation normalisée",
        "Heures réelles ou vendues associées à la prestation",
      ],
      impactEuro: impact > 0 ? impact : null,
      impactLabel: "Écart de marge annuel sur ces prestations",
      action: "Revoir le prix de vente ou le temps standard de ces prestations dans le catalogue.",
      to: "/pilot/prestations",
      weight: 80,
    });
  }

  // 4 — Prestations rentables à développer.
  const aDevelopper = services
    .filter((s) => (s.classe === "rentable" || s.classe === "strategique") && s.tauxHoraire != null)
    .sort((a, b) => (b.tauxHoraire ?? 0) - (a.tauxHoraire ?? 0));
  if (aDevelopper.length > 0) {
    const top = aDevelopper[0];
    out.push({
      key: "prestations-a-developper",
      theme: "Commercial",
      title: `Développer « ${top.prestation} »`,
      why: `Cette prestation dégage ${Math.round(top.tauxHoraire ?? 0)} €/h sur ${top.clients} client(s), au-dessus de la cible.`,
      sources: ["Lignes CA de la prestation", "Heures associées", "Taux horaire cible"],
      impactEuro: top.caYear > 0 && top.clients > 0 ? Math.round(top.caYear / top.clients) : null,
      impactLabel: "CA moyen apporté par client sur cette prestation",
      action: "Proposer cette prestation aux clients qui n'en bénéficient pas encore.",
      to: "/pilot/prestations",
      weight: 60,
    });
  }

  // 5 — Contrats CEEV non reconduits.
  const ceevYears = Array.from(new Set(ceevContracts.map((c) => c.year))).sort((a, b) => b - a);
  if (ceevYears.length >= 2) {
    const [latest, previous] = ceevYears;
    const { notRenewed } = renewalAnalysis(ceevContracts, previous, latest);
    if (notRenewed.length > 0) {
      const potentiel = notRenewed.reduce((s, c) => s + (Number(c.pv_ht) || 0), 0);
      out.push({
        key: "ceev-non-reconduits",
        theme: "Contrats",
        title: "Relancer les contrats d'entretien non reconduits",
        why: `${notRenewed.length} contrat(s) présents en ${previous} n'apparaissent pas en ${latest}.`,
        sources: ["Contrats CEEV importés (fichier Excel de référence)"],
        impactEuro: potentiel > 0 ? potentiel : null,
        impactLabel: `CA contrats ${previous} à reconquérir`,
        action: "Contacter ces clients pour proposer la reconduction du contrat d'entretien.",
        to: "/pilot/ceev",
        weight: 85,
      });
    }
  }

  // 6 — Contrats CEEV non rattachés à un client.
  const ceevAValider = ceevContracts.filter((c) => c.validation_status !== "valide" || !c.client_id);
  if (ceevAValider.length > 0) {
    out.push({
      key: "ceev-a-rattacher",
      theme: "Organisation",
      title: "Rattacher les contrats d'entretien à leur client",
      why: `${ceevAValider.length} contrat(s) importés ne sont pas encore reliés à une fiche client, ce qui fausse l'analyse par client.`,
      sources: ["Contrats CEEV importés", "Référentiel clients"],
      impactEuro: null,
      impactLabel: "Fiabilité de l'analyse par client",
      action: "Associer chaque contrat au bon client depuis la page CEEV.",
      to: "/pilot/ceev",
      weight: 45,
    });
  }

  // 7 — Relance des clients dormants / à relancer.
  const aReactiver = clientsARelancer + clientsDormants;
  if (aReactiver > 0) {
    const potentiel = caMoyenParClient > 0 ? caMoyenParClient * aReactiver : 0;
    out.push({
      key: "clients-a-reactiver",
      theme: "Commercial",
      title: "Réactiver les clients inactifs",
      why: `${clientsARelancer} client(s) sans activité depuis plus de 6 mois et ${clientsDormants} depuis plus de 12 mois.`,
      sources: ["Référentiel clients", "Dernière intervention ou ligne CA connue"],
      impactEuro: potentiel > 0 ? potentiel : null,
      impactLabel: `Potentiel au CA moyen par client de ${year}`,
      action: "Programmer une campagne de relance ciblée sur ces clients.",
      to: "/pilot/focus/dormants",
      weight: 70,
    });
  }

  // 8 — Clients à données insuffisantes : fiabiliser avant décision.
  const sansDonnees = clients.filter((c) => c.classe === "non_classe" && c.caYear > 0);
  if (sansDonnees.length > 0) {
    out.push({
      key: "clients-donnees-insuffisantes",
      theme: "Organisation",
      title: "Compléter les heures manquantes",
      why: `${sansDonnees.length} client(s) génèrent du CA en ${year} sans heure connue : leur rentabilité ne peut pas être calculée.`,
      sources: ["Lignes CA de l'exercice", "Ledger consolidé des heures"],
      impactEuro: null,
      impactLabel: "Fiabilité du taux horaire réel",
      action: "Renseigner les heures sur les interventions concernées.",
      to: "/pilot/focus/heures-manquantes",
      weight: 50,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}