/**
 * Radar Visibilité locale — générateur de brouillon de page locale (phase 2).
 * Fonctions pures : produit du contenu, ne publie rien. Cadre : cahier des charges du 23/10/2026
 * (vouvoiement, ton solennel/pédagogique/chaleureux, aucun prix ni garantie ni superlatif, aucune donnée client,
 * structure GEO : réponse d'abord, FAQ, données structurées).
 */
import { TARGET_COMMUNES, type ScoredPrestation } from "@/lib/visibilite-locale";
import { PROFILES, Rand } from "@/lib/visibilite-locale-communes";
import {
  composeAp,
  composeConseil,
  composeRemise,
  composeSap,
  type FaqItem,
  type Part,
} from "@/lib/visibilite-locale-redaction";

export type { FaqItem };

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
    label: "mon approche du jardin méditerranéen",
  },
  Conseil: { path: "/conseil-jardin-montpellier/", label: "ma visite conseil" },
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

interface Meta {
  slugPrefix: string;
  h1: (c: string, loc: string) => string;
  keyword: (c: string) => string;
  metaDescription: (c: string, loc: string) => string;
}

const META: Record<ScoredPrestation, Meta> = {
  AP: {
    slugPrefix: "creation-jardin-mediterraneen",
    h1: (c, loc) => `Création de jardin méditerranéen ${loc}`,
    keyword: (c) => `création jardin méditerranéen ${c}`,
    metaDescription: (c, loc) =>
      `Création de jardin méditerranéen ${loc} : visite sur place, projet adapté au climat, plantations et suivi. ${BUSINESS.name}.`,
  },
  Conseil: {
    slugPrefix: "visite-conseil-jardin",
    h1: (c, loc) => `Visite conseil jardin ${loc}`,
    keyword: (c) => `visite conseil jardin ${c}`,
    metaDescription: (c, loc) =>
      `Visite conseil jardin ${loc} : observation sur place, compte-rendu écrit et priorités d'action. ${BUSINESS.name}.`,
  },
  SAP: {
    slugPrefix: "entretien-jardin",
    h1: (c, loc) => `Entretien de jardin ${loc}`,
    keyword: (c) => `entretien jardin ${c}`,
    metaDescription: (c, loc) =>
      `Entretien de jardin ${loc} : passages réguliers adaptés à la saison, taille, désherbage et conseils. ${BUSINESS.name}.`,
  },
  "Remise en état": {
    slugPrefix: "remise-en-etat-jardin",
    h1: (c, loc) => `Remise en état de jardin ${loc}`,
    keyword: (c) => `remise en état jardin ${c}`,
    metaDescription: (c, loc) =>
      `Remise en état de jardin ${loc} : évaluation sur place, nettoyage, taille et conseils pour la suite. ${BUSINESS.name}.`,
  },
};

const COMPOSERS = {
  AP: composeAp,
  Conseil: composeConseil,
  SAP: composeSap,
  "Remise en état": composeRemise,
} as const;

function clientsSentence(loc: string, count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return `J'accompagne déjà un jardin ${loc}.`;
  return `J'accompagne déjà plusieurs jardins ${loc}.`;
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
  {
    label: "cliché de rédaction automatique",
    pattern:
      /n'hésitez pas|dans cet article|il est important de noter|en conclusion|de nos jours|au cœur de|véritable écrin|havre de paix/i,
  },
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
    { label: "Vouvoiement", ok: !/(?<![\p{L}])(tu|ton|ta|tes|toi)(?![\p{L}])/iu.test(text) },
    { label: "Commune dans le titre", ok: draft.title.includes(commune.replace(/^Le /, "")) },
    {
      label: "Nom de la commune sans excès",
      ok:
        (text.split(commune.replace(/^Le /, "")).length - 1) / Math.max(1, draft.wordCount) <=
        0.025,
    },
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
      ok: draft.wordCount >= 650,
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

function renderPart(part: Part): string {
  if ("p" in part) return `<p>${escapeHtml(part.p)}</p>`;
  if ("h3" in part) return `<h3>${escapeHtml(part.h3)}</h3>`;
  const items = "ul" in part ? part.ul : part.ol;
  const tag = "ul" in part ? "ul" : "ol";
  return `<${tag}>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</${tag}>`;
}

export function buildPageDraft(input: PageInput): PageDraft {
  const meta = META[input.prestation];
  const c = input.commune;
  const profile = PROFILES[c];
  if (!profile) throw new Error(`Commune inconnue : ${c}`);
  const r = new Rand(`${input.prestation}|${c}`);
  const others = TARGET_COMMUNES.map((t) => t.name).filter((n) => n !== c);
  const comp = COMPOSERS[input.prestation]({ p: profile, r, others, business: BUSINESS.name });

  const title = meta.h1(c, profile.loc);
  const slug = `${meta.slugPrefix}-${slugify(c)}`;
  const faq = r.pickN(comp.faqPool, comp.faqCount);
  const model = MODEL_LINKS[input.prestation];
  const contactUrl = `${BUSINESS.url}${BUSINESS.contactPath}`;
  const proof = clientsSentence(profile.loc, input.clientCount);

  const particularity = input.particularity?.trim();
  const placeholderText =
    particularity ||
    `${PLACEHOLDER_MARK} : un exemple concret ${profile.loc} (type de jardin, contrainte rencontrée, solution choisie), à rédiger par vos soins.]`;

  const blocks = [...comp.fixed, ...r.shuffle(comp.floating)];
  const parts: string[] = [];
  comp.intro.forEach((t) => parts.push(`<p>${escapeHtml(t)}</p>`));
  blocks.forEach((block, index) => {
    parts.push(`<h2>${escapeHtml(block.h2)}</h2>`);
    block.parts.forEach((part) => parts.push(renderPart(part)));
    if (index === Math.min(1, blocks.length - 1)) {
      if (proof) parts.push(`<p>${escapeHtml(proof)}</p>`);
      parts.push(`<p>${escapeHtml(placeholderText)}</p>`);
    }
    if (model && index === blocks.length - 2) {
      parts.push(
        `<p>Pour en savoir plus, vous pouvez consulter <a href="${BUSINESS.url}${model.path}">${escapeHtml(model.label)}</a>.</p>`,
      );
    }
  });
  parts.push(`<h2>Questions fréquentes</h2>`);
  faq.forEach((f) => {
    parts.push(`<h3>${escapeHtml(f.question)}</h3>`);
    parts.push(`<p>${escapeHtml(f.answer)}</p>`);
  });
  parts.push(`<h2>${escapeHtml(comp.cta.h2)}</h2>`);
  parts.push(
    `<p>${escapeHtml(comp.cta.text)} <a href="${contactUrl}">Contacter ${escapeHtml(BUSINESS.name)}</a>.</p>`,
  );

  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          name: title,
          serviceType: meta.keyword(c).replace(` ${c.toLowerCase()}`, ""),
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
    metaDescription: meta.metaDescription(c, profile.loc),
    focusKeyword: input.topQueries[0] ?? meta.keyword(c),
    html,
    faq,
    jsonLd,
    wordCount: wordCountOf(body),
    placeholders: (body.match(/\[À compléter/g) ?? []).length,
  };
  return { ...draftBase, checks: validateDraft(draftBase, c) };
}
