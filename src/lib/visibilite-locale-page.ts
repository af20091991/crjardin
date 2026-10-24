/**
 * Radar Visibilité locale — générateur de brouillon de page locale (phase 2).
 * Fonctions pures : produit du contenu, ne publie rien. Cadre : cahier des charges du 23/10/2026
 * (vouvoiement, ton solennel/pédagogique/chaleureux, aucun prix ni garantie ni superlatif, aucune donnée client,
 * structure GEO : réponse d'abord, FAQ, données structurées).
 */
import { TARGET_COMMUNES, type ScoredPrestation } from "@/lib/visibilite-locale";

export const BUSINESS = {
  name: "De la graine au jardin",
  url: "https://www.delagraineaujardin.com",
  locality: "Vendargues",
  postalCode: "34740",
  region: "Occitanie",
  contactPath: "/contact-devis-paysagiste-jardin/",
} as const;

/** Pages modèles du site, utilisées pour le maillage interne. */
export const MODEL_LINKS: Partial<Record<ScoredPrestation, { path: string; label: string }>> = {
  AP: {
    path: "/jardin-mediterraneen-montpellier/",
    label: "notre approche du jardin méditerranéen",
  },
  Conseil: { path: "/conseil-jardin-montpellier/", label: "notre visite conseil" },
};

/** Nombre maximum de pages créées par mois (cahier des charges 6.2). */
export const MAX_PAGES_PER_MONTH = 4;

export const PLACEHOLDER_MARK = "[À compléter";

export interface PageInput {
  prestation: ScoredPrestation;
  commune: string;
  /** Nombre de clients localisés dans la commune (0 = aucun ou inconnu) : sert à une mention factuelle, jamais nominative. */
  clientCount: number;
  /** Requêtes réellement tapées sur Google pour ce couple (pour le mot-clé principal). */
  topQueries: string[];
  /** Particularité locale rédigée par l'utilisateur ; sinon un passage « À compléter » est inséré. */
  particularity?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface PageDraft {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  html: string;
  faq: FaqItem[];
  jsonLd: string;
  wordCount: number;
  placeholders: number;
  checks: Check[];
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Copy {
  slugPrefix: string;
  h1: (c: string) => string;
  keyword: (c: string) => string;
  inBrief: (c: string) => string;
  why: { heading: (c: string) => string; paragraphs: (c: string) => string[] };
  steps: { heading: string; items: string[] };
  benefits: { heading: string; items: string[] };
  faq: (c: string) => FaqItem[];
  cta: (c: string) => string;
  metaDescription: (c: string) => string;
}

const CLIMATE = (c: string) =>
  `À ${c}, comme dans le reste de l'Hérault, le climat est méditerranéen : étés chauds et secs, hivers doux, pluies concentrées à l'automne. Un jardin réussi tient compte de ces conditions dès sa conception.`;

const COPY: Record<ScoredPrestation, Copy> = {
  AP: {
    slugPrefix: "creation-jardin-mediterraneen",
    h1: (c) => `Création de jardin méditerranéen à ${c}`,
    keyword: (c) => `création jardin méditerranéen ${c}`,
    inBrief: (c) =>
      `${BUSINESS.name} conçoit et réalise des jardins méditerranéens à ${c} et dans les communes voisines de l'Hérault. Chaque projet commence par une visite sur place, puis se poursuit par un aménagement adapté au sol, à l'exposition et à votre manière de vivre le jardin.`,
    why: {
      heading: (c) => `Un jardin pensé pour le climat de ${c}`,
      paragraphs: (c) => [
        CLIMATE(c),
        "Nous privilégions des végétaux adaptés à la sécheresse, un arrosage raisonné et des matériaux qui s'intègrent au paysage. Le résultat : un jardin agréable en toute saison, plus simple à entretenir.",
      ],
    },
    steps: {
      heading: "Notre façon de travailler",
      items: [
        "Visite sur place : nous observons le terrain, le sol, l'exposition et vos usages.",
        "Projet : nous définissons ensemble les espaces, la palette végétale et le principe d'arrosage.",
        "Réalisation : préparation du sol, plantations, paillage et finitions.",
        "Conseils de suivi : nous vous expliquons comment accompagner le jardin dans la durée.",
      ],
    },
    benefits: {
      heading: "Ce que vous pouvez en attendre",
      items: [
        "Des plantes choisies pour résister aux étés secs.",
        "Un arrosage maîtrisé.",
        "Un entretien allégé une fois le jardin installé.",
        "Un espace accueillant pour la faune et la flore locales.",
      ],
    },
    faq: (c) => [
      {
        question: `Qu'est-ce qu'un jardin méditerranéen à ${c} ?`,
        answer: `C'est un jardin conçu pour le climat local : végétaux résistants à la sécheresse, sol protégé par un paillage, arrosage limité. Il reste vivant et fleuri en toute saison, avec moins d'eau et moins d'entretien.`,
      },
      {
        question: `Faut-il une visite avant de recevoir une proposition pour mon jardin à ${c} ?`,
        answer:
          "Oui. La visite sur place permet d'observer le terrain et de comprendre vos attentes avant toute proposition.",
      },
      {
        question: "Quelles plantes résistent bien à la sécheresse ?",
        answer:
          "On utilise couramment des lavandes, romarins, cistes, santolines ou oliviers. Le choix dépend toujours du sol, de l'exposition et du style recherché.",
      },
      {
        question: "Combien de temps dure la création d'un jardin ?",
        answer:
          "La durée dépend de la surface et de la complexité du projet. Elle est précisée à l'issue de la visite sur place.",
      },
    ],
    cta: (c) => `Parlons de votre jardin à ${c}`,
    metaDescription: (c) =>
      `Création de jardin méditerranéen à ${c} : visite sur place, projet adapté au climat, plantations et conseils de suivi. ${BUSINESS.name}.`,
  },
  Conseil: {
    slugPrefix: "visite-conseil-jardin",
    h1: (c) => `Visite conseil jardin à ${c}`,
    keyword: (c) => `visite conseil jardin ${c}`,
    inBrief: (c) =>
      `La visite conseil de ${BUSINESS.name} permet de faire le point sur votre jardin à ${c} : nous observons le terrain, répondons à vos questions et vous indiquons les priorités pour améliorer, aménager ou entretenir votre espace.`,
    why: {
      heading: () => "À quoi sert une visite conseil ?",
      paragraphs: (c) => [
        `Avant d'engager des travaux ou lorsqu'un jardin ne donne pas satisfaction, un regard professionnel sur place fait gagner du temps. À ${c}, le climat méditerranéen impose des choix précis de végétaux, d'arrosage et d'entretien.`,
        "Nous vous aidons à comprendre ce qui fonctionne, ce qui peut être amélioré et dans quel ordre agir.",
      ],
    },
    steps: {
      heading: "Comment se déroule la visite",
      items: [
        "Échange préalable : vous nous expliquez vos attentes et vos difficultés.",
        "Observation sur place : sol, exposition, végétation existante, arrosage.",
        "Recommandations : nous vous indiquons les actions utiles et leur ordre de priorité.",
      ],
    },
    benefits: {
      heading: "Pour qui ?",
      items: [
        "Vous souhaitez créer ou transformer votre jardin et avez besoin d'un avis avant de vous lancer.",
        "Certaines plantations ne se développent pas comme prévu.",
        "Vous voulez réduire l'arrosage et l'entretien.",
      ],
    },
    faq: (c) => [
      {
        question: `En quoi consiste une visite conseil jardin à ${c} ?`,
        answer:
          "Nous nous rendons chez vous pour observer le jardin, écouter vos besoins et vous donner des recommandations claires et hiérarchisées.",
      },
      {
        question: "La visite conseil est-elle utile avant un projet de création ?",
        answer:
          "Oui, c'est souvent la première étape : elle permet de définir ce qui est réalisable et dans quel ordre avant d'engager des travaux.",
      },
      {
        question: "Faut-il être présent pendant la visite ?",
        answer:
          "Votre présence est recommandée : elle nous permet d'échanger directement sur vos attentes et vos habitudes.",
      },
    ],
    cta: (c) => `Planifier une visite conseil à ${c}`,
    metaDescription: (c) =>
      `Visite conseil jardin à ${c} : observation sur place, recommandations claires et priorités d'action. ${BUSINESS.name}.`,
  },
  SAP: {
    slugPrefix: "entretien-jardin",
    h1: (c) => `Entretien de jardin à ${c}`,
    keyword: (c) => `entretien jardin ${c}`,
    inBrief: (c) =>
      `${BUSINESS.name} assure l'entretien régulier de jardins de particuliers à ${c} et dans les environs : passages réguliers, adaptés à la saison et aux besoins de votre jardin.`,
    why: {
      heading: (c) => `Un entretien adapté au climat de ${c}`,
      paragraphs: (c) => [
        CLIMATE(c),
        "Les travaux d'entretien changent d'une saison à l'autre : taille, désherbage, paillage, surveillance de l'arrosage. Un calendrier régulier évite que le jardin ne demande de gros efforts de rattrapage.",
      ],
    },
    steps: {
      heading: "Comment cela fonctionne",
      items: [
        "Visite initiale pour définir les besoins du jardin.",
        "Rythme de passage adapté : mensuel, saisonnier ou selon vos besoins.",
        "Interventions suivies et expliquées à chaque passage.",
      ],
    },
    benefits: {
      heading: "Ce que couvre l'entretien",
      items: [
        "Taille des arbustes et des haies.",
        "Désherbage et entretien des massifs.",
        "Paillage et suivi de l'arrosage.",
        "Conseils pour accompagner le jardin au fil des saisons.",
      ],
    },
    faq: (c) => [
      {
        question: `À quelle fréquence faire entretenir son jardin à ${c} ?`,
        answer:
          "Le rythme dépend du jardin et de la saison. Il est défini avec vous lors de la visite initiale : mensuel, saisonnier ou ponctuel.",
      },
      {
        question: "L'entretien est-il adapté à un jardin méditerranéen ?",
        answer:
          "Oui. Les gestes sont choisis pour respecter des végétaux habitués à la sécheresse, en limitant l'arrosage et en protégeant le sol.",
      },
    ],
    cta: (c) => `Parler de l'entretien de votre jardin à ${c}`,
    metaDescription: (c) =>
      `Entretien de jardin à ${c} : passages réguliers adaptés à la saison, taille, désherbage et conseils. ${BUSINESS.name}.`,
  },
  "Remise en état": {
    slugPrefix: "remise-en-etat-jardin",
    h1: (c) => `Remise en état de jardin à ${c}`,
    keyword: (c) => `remise en état jardin ${c}`,
    inBrief: (c) =>
      `${BUSINESS.name} remet en état les jardins négligés à ${c} et dans les communes voisines : nettoyage, taille de remise en forme et préparation d'un jardin qu'il sera ensuite simple d'entretenir.`,
    why: {
      heading: () => "Pourquoi remettre un jardin en état ?",
      paragraphs: (c) => [
        `Un jardin laissé quelques saisons sans entretien peut se refermer rapidement. À ${c}, la végétation méditerranéenne repart vite au printemps.`,
        "Une remise en état permet de repartir sur des bases saines avant d'envisager un entretien régulier ou un nouvel aménagement.",
      ],
    },
    steps: {
      heading: "Notre façon de travailler",
      items: [
        "Visite sur place pour évaluer l'état du jardin.",
        "Définition des priorités : ce qui est conservé, taillé ou retiré.",
        "Intervention, puis conseils pour la suite.",
      ],
    },
    benefits: {
      heading: "Ce que cela permet",
      items: [
        "Retrouver un jardin accessible et agréable.",
        "Préparer un entretien régulier plus léger.",
        "Se projeter dans un nouvel aménagement.",
      ],
    },
    faq: (c) => [
      {
        question: `Que comprend la remise en état d'un jardin à ${c} ?`,
        answer:
          "Elle comprend l'évaluation du jardin, le nettoyage et la taille nécessaires, puis des conseils pour la suite. Le détail est précisé après la visite.",
      },
      {
        question: "Peut-on enchaîner avec un entretien régulier ?",
        answer: "Oui, c'est fréquent : la remise en état prépare un entretien plus simple.",
      },
    ],
    cta: (c) => `Demander une visite pour votre jardin à ${c}`,
    metaDescription: (c) =>
      `Remise en état de jardin à ${c} : évaluation sur place, nettoyage, taille et conseils. ${BUSINESS.name}.`,
  },
};

function clientsSentence(commune: string, count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return `Nous accompagnons déjà un jardin à ${commune}.`;
  return `Nous accompagnons déjà plusieurs jardins à ${commune}.`;
}

/** Mots et formulations interdits par le cahier des charges (prix, garanties, superlatifs non prouvés). */
const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: "prix ou montant", pattern: /\d\s*(€|euros?\b)|\bà partir de\b|\bdevis gratuit\b/i },
  { label: "garantie", pattern: /\bgarant(i|ie|ies|it|issons)\b/i },
  {
    label: "superlatif non prouvé",
    pattern: /\b(meilleur|meilleurs|n°\s*1|numéro un|leader|incomparable)\b/i,
  },
  { label: "promesse chiffrée", pattern: /\b100\s*%/ },
];

export function wordCountOf(text: string): number {
  return text
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function plainText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
}

export function validateDraft(
  draft: Pick<
    PageDraft,
    | "html"
    | "metaTitle"
    | "metaDescription"
    | "title"
    | "placeholders"
    | "wordCount"
    | "faq"
    | "jsonLd"
  >,
  commune: string,
): Check[] {
  const text = plainText(draft.html);
  const checks: Check[] = FORBIDDEN.map((f) => ({
    label: `Aucun ${f.label}`,
    ok: !f.pattern.test(text),
  }));
  checks.push(
    { label: "Vouvoiement", ok: !/\b(tu|ton|ta|tes|toi)\b/i.test(text) },
    { label: "Commune dans le titre", ok: draft.title.includes(commune) },
    {
      label: "Titre SEO ≤ 60 caractères",
      ok: draft.metaTitle.length <= 60,
      detail: `${draft.metaTitle.length} caractères`,
    },
    {
      label: "Description SEO ≤ 155 caractères",
      ok: draft.metaDescription.length <= 155,
      detail: `${draft.metaDescription.length} caractères`,
    },
    {
      label: "FAQ présente (GEO)",
      ok: draft.faq.length >= 2,
      detail: `${draft.faq.length} questions`,
    },
    {
      label: "Données structurées valides",
      ok: (() => {
        try {
          JSON.parse(draft.jsonLd);
          return true;
        } catch {
          return false;
        }
      })(),
    },
    {
      label: "Longueur suffisante",
      ok: draft.wordCount >= 250,
      detail: `${draft.wordCount} mots`,
    },
    {
      label: "Passages à compléter",
      ok: draft.placeholders === 0,
      detail:
        draft.placeholders > 0 ? `${draft.placeholders} à renseigner avant publication` : undefined,
    },
  );
  return checks;
}

export function buildPageDraft(input: PageInput): PageDraft {
  const copy = COPY[input.prestation];
  const c = input.commune;
  const title = copy.h1(c);
  const slug = `${copy.slugPrefix}-${slugify(c)}`;
  const nearby = TARGET_COMMUNES.map((t) => t.name).filter((n) => n !== c);
  const faq = copy.faq(c);
  const model = MODEL_LINKS[input.prestation];
  const contactUrl = `${BUSINESS.url}${BUSINESS.contactPath}`;
  const proof = clientsSentence(c, input.clientCount);

  const li = (items: string[]) =>
    `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  const ol = (items: string[]) =>
    `<ol>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`;
  const p = (t: string) => `<p>${escapeHtml(t)}</p>`;

  const particularity = input.particularity?.trim();
  const placeholderText =
    particularity ||
    `${PLACEHOLDER_MARK} : une particularité de ${c} utile au lecteur (quartier, type de terrain, usage fréquent des jardins), à rédiger par vos soins.]`;

  const parts: string[] = [];
  parts.push(`<p><strong>En bref.</strong> ${escapeHtml(copy.inBrief(c))}</p>`);
  parts.push(`<h2>${escapeHtml(copy.why.heading(c))}</h2>`);
  copy.why.paragraphs(c).forEach((t) => parts.push(p(t)));
  parts.push(`<h2>${escapeHtml(copy.steps.heading)}</h2>`);
  parts.push(ol(copy.steps.items));
  parts.push(`<h2>${escapeHtml(copy.benefits.heading)}</h2>`);
  parts.push(li(copy.benefits.items));
  parts.push(`<h2>Intervention à ${escapeHtml(c)} et dans les environs</h2>`);
  parts.push(
    p(
      `${BUSINESS.name} est installée à ${BUSINESS.locality} (Hérault) et intervient à ${c} ainsi qu'à ${nearby.slice(0, -1).join(", ")} et ${nearby[nearby.length - 1]}.${proof ? ` ${proof}` : ""}`,
    ),
  );
  parts.push(p(placeholderText));
  if (model) {
    parts.push(
      `<p>Pour en savoir plus, découvrez <a href="${BUSINESS.url}${model.path}">${escapeHtml(model.label)}</a>.</p>`,
    );
  }
  parts.push(`<h2>Questions fréquentes</h2>`);
  faq.forEach((f) => {
    parts.push(`<h3>${escapeHtml(f.question)}</h3>`);
    parts.push(p(f.answer));
  });
  parts.push(`<h2>${escapeHtml(copy.cta(c))}</h2>`);
  parts.push(
    `<p>Décrivez-nous votre projet : nous vous répondrons pour convenir d'une visite. <a href="${contactUrl}">Contacter ${escapeHtml(BUSINESS.name)}</a>.</p>`,
  );

  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          name: title,
          serviceType: copy.keyword(c).replace(` ${c.toLowerCase()}`, ""),
          provider: {
            "@type": "LocalBusiness",
            name: BUSINESS.name,
            url: BUSINESS.url,
            address: {
              "@type": "PostalAddress",
              addressLocality: BUSINESS.locality,
              postalCode: BUSINESS.postalCode,
              addressRegion: BUSINESS.region,
              addressCountry: "FR",
            },
          },
          areaServed: { "@type": "City", name: c },
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        },
      ],
    },
    null,
    2,
  );

  const body = parts.join("\n");
  const html = `${body}\n<script type="application/ld+json">${jsonLd}</script>`;
  const metaTitle =
    `${title} | ${BUSINESS.name}`.length <= 60 ? `${title} | ${BUSINESS.name}` : title;
  const draftBase = {
    slug,
    title,
    metaTitle,
    metaDescription: copy.metaDescription(c),
    focusKeyword: input.topQueries[0] ?? copy.keyword(c),
    html,
    faq,
    jsonLd,
    wordCount: wordCountOf(body),
    placeholders: (body.match(/\[À compléter/g) ?? []).length,
  };
  return { ...draftBase, checks: validateDraft(draftBase, c) };
}
