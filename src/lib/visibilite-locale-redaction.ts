/**
 * Radar — rédaction des pages locales (phase 2, version enrichie).
 * Chaque page est composée à partir : (1) de la fiche de la commune (faits vérifiés, situations courantes),
 * (2) de variantes de phrases et de sections choisies de façon déterministe, (3) d'un ordre de sections qui change.
 * Voix : « je » (entrepreneur) et « vous » (le lecteur), comme sur les pages modèles du site.
 */
import { Rand, type CommuneProfile } from "@/lib/visibilite-locale-communes";

export interface FaqItem {
  question: string;
  answer: string;
}

export type Part = { p: string } | { ul: string[] } | { ol: string[] } | { h3: string };

export interface Block {
  h2: string;
  parts: Part[];
}

export interface Composition {
  /** Paragraphes d'ouverture : la réponse directe vient en premier (lecture par les moteurs de réponse). */
  intro: string[];
  /** Sections dans l'ordre. */
  fixed: Block[];
  /** Sections dont l'ordre varie d'une page à l'autre. */
  floating: Block[];
  faqPool: FaqItem[];
  faqCount: number;
  cta: { h2: string; text: string };
}

export interface Ctx {
  p: CommuneProfile;
  r: Rand;
  /** Autres communes de la zone d'intervention. */
  others: string[];
  business: string;
}

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;

const p = (text: string): Part => ({ p: text });

function climate(c: Ctx): string {
  return c.r.pick([
    "Le climat méditerranéen impose son rythme : des étés chauds et secs, des hivers doux, et des pluies qui tombent surtout à l'automne, parfois en quelques heures.",
    "Soleil généreux, étés secs, vent certains jours et pluies d'automne souvent brutales : c'est avec ces données qu'un jardin du secteur se pense.",
    "Ici, la pluie arrive à l'automne, souvent d'un seul coup, et l'été s'installe longtemps : un jardin doit pouvoir encaisser les deux sans broncher.",
  ]);
}

function soil(c: Ctx): string {
  return c.r.pick([
    "Dans l'Hérault, les sols sont souvent calcaires, parfois argileux : leur nature oriente le choix des plantes davantage que le style recherché.",
    "Le sol décide de beaucoup de choses. Calcaire ou argileux, drainant ou lourd, il détermine ce qui s'installera sans effort et ce qui demandera des soins permanents.",
    "Avant de parler de plantes, je regarde la terre : sa couleur, sa structure, la façon dont l'eau s'y infiltre. Dans le secteur, elle est le plus souvent calcaire, parfois argileuse.",
  ]);
}

const PLANTS: Record<string, string> = {
  lavandes:
    "les lavandes, parfumées, appréciées des abeilles et très économes en eau une fois installées",
  cistes:
    "les cistes, qui fleurissent généreusement au printemps et supportent sol pauvre et sécheresse",
  romarins: "les romarins, persistants et aromatiques, utiles en couvre-sol comme en haie basse",
  santolines: "les santolines, au feuillage gris argenté, compactes et parfaites en bordure",
  "sauge de Jérusalem":
    "la sauge de Jérusalem, au feuillage velouté et aux fleurs jaunes du début d'été",
  oliviers: "les oliviers, silhouette légère et emblématique, qui résistent à la sécheresse",
  "olivier en bac": "l'olivier en grand bac, qui garde une belle allure sur une terrasse",
  arbousier: "l'arbousier, persistant, dont les fruits rouges égayent l'automne",
  "chêne vert":
    "le chêne vert, l'arbre de la garrigue, quand le terrain est assez grand pour l'accueillir",
  achillées: "les achillées, aux ombelles légères qui fleurissent tout l'été",
  gattilier: "le gattilier, dont les épis bleutés illuminent les étés les plus chauds",
  perovskia: "la sauge russe (perovskia), aux tiges bleutées et vaporeuses en plein été",
  myrte: "le myrte, persistant, parfumé, qui se taille facilement en boule ou en haie basse",
  "jasmin étoilé": "le jasmin étoilé, grimpant parfumé qui habille un mur sans prendre de place",
  "viorne tin":
    "la viorne tin, persistante, qui fleurit en plein hiver et fait de très bonnes haies libres",
};
const EXTRA_PLANTS = ["lavandes", "cistes", "romarins", "santolines", "achillées", "myrte"];

function plantLines(c: Ctx, n: number): string[] {
  const focus = c.p.plantFocus.filter((k) => PLANTS[k]);
  const fillers = EXTRA_PLANTS.filter((k) => !focus.includes(k));
  const chosen = [...focus.slice(0, Math.min(n, focus.length)), ...c.r.shuffle(fillers)].slice(
    0,
    n,
  );
  return c.r.shuffle(chosen).map((k) => {
    const text = PLANTS[k];
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  });
}

/** Première phrase de la fiche (qui nomme la commune), puis une autre au hasard. */
function identityParagraph(c: Ctx): string {
  const [first, ...rest] = c.p.identity;
  return rest.length ? `${first} ${c.r.pick(rest)}` : first;
}

function neighbours(c: Ctx, n = 3): string {
  return list(c.r.pickN(c.others, n));
}

/* -------------------------------------------------------------------------------------------------- */
/* Création de jardin méditerranéen                                                                   */
/* -------------------------------------------------------------------------------------------------- */
export function composeAp(c: Ctx): Composition {
  const { p: pr, r } = c;
  const intro = [
    r.pick([
      `Vous cherchez un paysagiste pour créer un jardin méditerranéen ${pr.loc} ? ${c.business} conçoit et réalise des jardins pensés pour le climat local : peu d'eau, des plantes qui traversent l'été sec et un entretien raisonnable une fois le jardin installé.`,
      `Créer un jardin méditerranéen ${pr.loc}, c'est composer avec le soleil, le vent et des pluies concentrées à l'automne. C'est ce que je fais avec ${c.business} : concevoir et planter des jardins qui restent beaux avec peu d'eau.`,
      `Un jardin méditerranéen réussi ressemble au paysage qui l'entoure : feuillages argentés, floraisons étalées sur l'année, massifs qui n'ont pas besoin d'un arrosage quotidien. Je le conçois et je le plante ${pr.loc} et dans les communes voisines.`,
    ]),
    identityParagraph(c),
  ];

  const fixed: Block[] = [
    {
      h2: r.pick([
        `Ce que j'observe d'abord ${pr.loc}`,
        `Comprendre le terrain ${pr.de} avant de dessiner`,
        `Un jardin ${pr.loc} : les contraintes à connaître`,
      ]),
      parts: [p(climate(c)), p(r.pickN(pr.gardens, 2).join(" ")), p(soil(c))],
    },
  ];

  const floating: Block[] = [
    {
      h2: r.pick([
        `Quelles plantes choisir pour un jardin ${pr.loc} ?`,
        `Le choix des végétaux : ce qui fonctionne vraiment ${pr.loc}`,
        `Une palette végétale adaptée ${pr.loc}`,
      ]),
      parts: [
        p(
          r.pick([
            `Il n'y a pas de recette unique, mais on retrouve souvent les mêmes alliés. Voici ceux que je privilégie quand ${pr.challenge} est la principale difficulté :`,
            `La garrigue offre un vocabulaire végétal très riche. Pour ce type de jardin, j'y puise souvent :`,
            `Selon l'exposition et le sol, ma palette change, mais elle repose volontiers sur :`,
          ]),
        ),
        { ul: plantLines(c, 5) },
        p(
          r.pick([
            "Le but n'est pas de tout mélanger : trois ou quatre végétaux bien choisis, répétés, donnent un ensemble plus calme et plus facile à vivre qu'une collection.",
            "Associer des formes (boules, tiges dressées, couvre-sols) et des feuillages (gris, vert sombre, vert tendre) compte autant que les fleurs : c'est ce qui fait un jardin agréable en hiver comme en juillet.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick([
        "Arroser moins sans sacrifier le jardin",
        "La gestion de l'eau, au cœur du projet",
        `L'eau, le point qui change tout ${pr.loc}`,
      ]),
      parts: [
        p(
          r.pick([
            "Un goutte-à-goutte bien réglé apporte l'eau là où les racines en ont besoin, sans la gaspiller. Avec un programmateur, l'arrosage automatique se fait même oublier.",
            "Je prévois toujours l'arrosage dès le dessin du jardin : un réseau en goutte-à-goutte enterré ou posé sous paillage, avec des zones distinctes pour les massifs, les arbres et les bacs.",
          ]),
        ),
        p(
          r.pick([
            "Le paillage fait le reste : écorces, copeaux ou galets gardent la fraîcheur du sol, limitent les mauvaises herbes et protègent les racines des coups de chaleur.",
            "Un bon paillage de cinq à dix centimètres réduit fortement l'évaporation. C'est le geste le plus simple et le plus efficace pour limiter l'arrosage d'été.",
          ]),
        ),
        p(
          "Certains étés, des restrictions d'arrosage peuvent être décidées localement. Un jardin conçu pour s'en passer en grande partie reste beau pendant ces périodes, ce qui n'est pas le cas d'une pelouse classique.",
        ),
      ],
    },
    {
      h2: r.pick([
        "Quand planter ?",
        `La bonne saison pour planter ${pr.loc}`,
        "Planter au bon moment, c'est la moitié du travail",
      ]),
      parts: [
        p(
          r.pick([
            "La période de plantation s'étend d'octobre à la fin de février : le sol est encore tiède, les pluies d'automne s'occupent des premiers arrosages et les racines s'installent avant le retour de la chaleur.",
            "On plante surtout d'octobre à fin février. Les végétaux profitent de la douceur de l'hiver pour enraciner, et ils abordent l'été avec un système racinaire déjà en place.",
          ]),
        ),
        r.chance(0.5)
          ? {
              ul: [
                "Octobre à novembre : plantation des arbres, arbustes et vivaces, première saison idéale.",
                "Décembre à février : poursuite des plantations hors périodes de gel, taille douce des arbustes existants.",
                "Mars à mai : semis, finitions, réglage du goutte-à-goutte avant l'été.",
              ],
            }
          : p(
              "Un jardin planté au printemps n'est pas impossible, mais il demande davantage d'arrosage la première année : c'est pourquoi je recommande, quand c'est possible, d'anticiper le projet pour planter à l'automne.",
            ),
      ],
    },
    {
      h2: r.pick([
        "Comment se déroule un projet",
        "De la visite à la plantation",
        "Les étapes, de la première visite au suivi",
      ]),
      parts: [
        {
          ol: [
            r.pick([
              "Visite sur place : j'observe le terrain, l'exposition, la végétation existante, et j'écoute ce que vous voulez faire de votre jardin.",
              "Première visite : nous faisons le tour du terrain ensemble, je regarde le sol, la lumière, les vues, et vous me dites comment vous vivez le jardin.",
            ]),
            "Projet : je dessine les espaces, je choisis la palette végétale et je définis le principe d'arrosage, avec vous.",
            "Réalisation : préparation du sol, plantations, paillage et finitions, à la période qui convient aux végétaux.",
            "Suivi : je vous explique comment accompagner le jardin la première année, et je peux assurer son entretien si vous le souhaitez.",
          ],
        },
      ],
    },
    {
      h2: r.pick([
        "Un jardin qui accueille la vie",
        "Biodiversité : un jardin qui n'est pas qu'un décor",
      ]),
      parts: [
        p(
          r.pick([
            "Un jardin méditerranéen bien pensé attire volontiers abeilles, papillons et oiseaux : lavandes, cistes, romarins fournissent nectar et abri presque toute l'année. J'évite les massifs trop denses et je laisse de la place aux insectes.",
            "En associant des floraisons étalées sur l'année, on donne à manger et à s'abriter à la petite faune. Ce n'est pas un effet de mode : c'est aussi ce qui rend le jardin plus résistant aux ravageurs.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick([
        `Intervention ${pr.loc} et dans les environs`,
        `Une entreprise de proximité`,
        `Où j'interviens`,
      ]),
      parts: [
        p(
          r.pick([
            `${c.business} est installée à Vendargues, à quelques minutes de ${pr.name}. Je travaille aussi à ${neighbours(c)} : connaître le secteur me permet de gagner du temps sur les choix de plantes et d'exposition.`,
            `L'entreprise est installée à Vendargues. ${pr.name} est dans mon secteur de travail, comme ${neighbours(c)} : je connais les sols, le vent et les habitudes de culture de ces communes.`,
          ]),
        ),
      ],
    },
  ];

  const faqPool: FaqItem[] = [
    {
      question: `Qu'est-ce qu'un jardin méditerranéen ${pr.loc} ?`,
      answer: `C'est un jardin pensé pour le climat local : des végétaux qui supportent la sécheresse, un sol protégé par un paillage et un arrosage limité. Il reste vivant et fleuri toute l'année, avec moins d'eau et moins d'entretien qu'un jardin classique.`,
    },
    {
      question: `Quand planter un jardin méditerranéen ${pr.loc} ?`,
      answer:
        "De préférence d'octobre à la fin de février. Les racines s'installent pendant la saison douce et les pluies d'automne facilitent la reprise, ce qui limite l'arrosage de la première année.",
    },
    {
      question: "Un jardin méditerranéen consomme-t-il vraiment moins d'eau ?",
      answer:
        "Oui, une fois les plantes installées (comptez une à deux saisons). Avec un paillage et un goutte-à-goutte réglé, les besoins en eau sont nettement inférieurs à ceux d'une pelouse ou d'un massif classique.",
    },
    {
      question: "Un jardin sec est-il forcément minéral ?",
      answer:
        "Pas du tout. On peut avoir un jardin très végétal, avec des arbustes, des vivaces et des couvre-sols, sans arrosage quotidien. Le minéral (gravier, galets, pierre) sert à structurer, pas à remplacer les plantes.",
    },
    {
      question: "Faut-il une visite avant de recevoir une proposition ?",
      answer:
        "Oui. La visite sur place me permet d'observer le terrain, le sol et l'exposition, et de comprendre comment vous utilisez votre jardin avant de rien dessiner.",
    },
    {
      question: "Peut-on conserver les arbres et les haies existants ?",
      answer:
        "Souvent oui. Je regarde leur état et leur place dans le projet : un arbre en bonne santé est un atout, une haie vieillissante peut parfois être renouvelée par étapes.",
    },
    {
      question: "Combien de temps faut-il pour que le jardin soit installé ?",
      answer:
        "La plantation elle-même se fait en quelques jours, selon la surface. Les végétaux, eux, mettent en général deux à trois saisons pour atteindre leur volume et leur autonomie.",
    },
    {
      question: "Intervenez-vous aussi pour l'entretien après la création ?",
      answer:
        "Oui, je peux assurer le suivi et l'entretien du jardin après la plantation, avec des interventions adaptées aux saisons.",
    },
  ];
  if (pr.setting === "relief") {
    faqPool.push({
      question: "Mon terrain est en pente : est-ce un obstacle ?",
      answer:
        "Non, c'est souvent une chance. Murets, paliers et plantations couvrantes permettent de retenir la terre et l'eau, et de créer des espaces agréables à vivre.",
    });
  }
  if (pr.setting === "dense") {
    faqPool.push({
      question: "Mon jardin est petit : est-ce que cela vaut la peine d'y réfléchir ?",
      answer:
        "Oui, et même davantage : sur une petite surface, chaque choix pèse. Quelques végétaux bien placés et un arrosage adapté suffisent à créer un lieu agréable et intime.",
    });
  }

  return {
    intro,
    fixed,
    floating,
    faqPool,
    faqCount: 5,
    cta: {
      h2: r.pick([`Parlons de votre jardin ${pr.loc}`, `Un projet de jardin ${pr.loc} ?`]),
      text: r.pick([
        "Décrivez-moi votre terrain et vos envies : je vous réponds pour convenir d'une visite.",
        "Racontez-moi votre projet en quelques lignes : je reviens vers vous pour fixer un rendez-vous sur place.",
      ]),
    },
  };
}

/* -------------------------------------------------------------------------------------------------- */
/* Visite conseil                                                                                     */
/* -------------------------------------------------------------------------------------------------- */
export function composeConseil(c: Ctx): Composition {
  const { p: pr, r } = c;
  const intro = [
    r.pick([
      `Vous avez un jardin ${pr.loc} et vous hésitez sur ce qu'il faut en faire ? La visite conseil de ${c.business} sert à y voir clair : je viens chez vous, j'observe le terrain, je réponds à vos questions et je vous indique par où commencer.`,
      `Avant de lancer des travaux, ou quand un jardin ne donne pas satisfaction, un regard extérieur sur place fait gagner du temps et évite des erreurs. C'est le rôle de la visite conseil que je propose ${pr.loc} et dans les environs.`,
      `La visite conseil, c'est un moment pour parler de votre jardin ${pr.loc} avec quelqu'un qui le regarde en professionnel : ce qui fonctionne, ce qui peut être amélioré, et dans quel ordre agir.`,
    ]),
    identityParagraph(c),
  ];

  const fixed: Block[] = [
    {
      h2: r.pick([
        "En quoi consiste la visite conseil",
        "Ce qui se passe pendant la visite",
        "Une visite sur place, sans engagement",
      ]),
      parts: [
        p(
          r.pick([
            "Je me déplace à votre domicile pour une visite d'au moins une heure, consacrée à l'aménagement, à l'entretien et aux solutions adaptées au climat méditerranéen. Nous parlons de votre jardin tel qu'il est, pas d'un jardin théorique.",
            "La visite dure au minimum une heure. Je regarde le terrain avec vous, je note ce qui est important pour vous, et je vous donne un avis argumenté sur l'aménagement, l'entretien ou les plantations.",
          ]),
        ),
        {
          ul: [
            "Observation du sol, de l'exposition, de la végétation en place et des réseaux d'arrosage éventuels.",
            "Échange sur vos habitudes, vos contraintes et ce que vous souhaitez retrouver dans votre jardin.",
            "Premières pistes d'amélioration, classées par ordre de priorité.",
          ],
        },
      ],
    },
    {
      h2: r.pick([
        `Les jardins ${pr.de} : ce que je regarde en priorité`,
        `Jardins ${pr.de} : les situations que l'on rencontre`,
        `Ce que le terrain ${pr.de} impose`,
      ]),
      parts: [p(climate(c)), p(r.pickN(pr.gardens, 2).join(" "))],
    },
  ];

  const floating: Block[] = [
    {
      h2: r.pick(["Pour quels projets ?", "Dans quels cas faire appel à une visite conseil ?"]),
      parts: [
        {
          ul: r
            .shuffle([
              "Vous voulez créer ou transformer votre jardin et avez besoin d'un avis avant de vous lancer.",
              "Certaines plantations ne se développent pas comme prévu et vous ne savez pas pourquoi.",
              "Vous cherchez à réduire l'arrosage et l'entretien sans perdre en agrément.",
              "Vous venez d'acheter une maison et vous découvrez un jardin dont vous ne savez pas quoi faire.",
              "Une haie, un arbre ou une pelouse vous posent question.",
            ])
            .slice(0, 4),
        },
      ],
    },
    {
      h2: r.pick([
        "Ce que vous recevez après la visite",
        "Après la visite : un compte-rendu écrit",
      ]),
      parts: [
        p(
          r.pick([
            "À l'issue de la visite, je vous envoie par e-mail un compte-rendu écrit : ce que j'ai observé, mes recommandations et l'ordre dans lequel les mettre en œuvre. Vous pouvez le garder, le partager ou vous en servir pour consulter d'autres professionnels.",
            "Vous recevez un compte-rendu écrit par e-mail, avec mes observations et mes conseils classés par priorité. C'est un document concret, que vous pouvez relire à tête reposée.",
          ]),
        ),
        p(
          "Si vous souhaitez aller plus loin, la visite peut être le point de départ d'un projet de création ou d'un suivi d'entretien. Rien n'est obligatoire.",
        ),
      ],
    },
    {
      h2: r.pick([
        `Ce que le climat change pour un jardin ${pr.loc}`,
        "Le jardin face à l'été sec",
      ]),
      parts: [
        p(soil(c)),
        p(
          r.pick([
            "Quelques principes simples font souvent beaucoup : choisir des plantes adaptées à la sécheresse, pailler les massifs, arroser peu mais en profondeur et tailler au bon moment.",
            "Souvent, ce ne sont pas les plantes qui sont en cause, mais leur emplacement ou leur arrosage. Un diagnostic sur place le montre en quelques minutes.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick([`Intervention ${pr.loc} et alentours`, "Où je me déplace"]),
      parts: [
        p(
          `${c.business} est installée à Vendargues et je me déplace chez les particuliers qui ont un jardin, une cour ou une terrasse dans un rayon d'environ dix kilomètres autour de Montpellier, notamment ${pr.loc}, ${neighbours(c)}.`,
        ),
      ],
    },
  ];

  const faqPool: FaqItem[] = [
    {
      question: `En quoi consiste une visite conseil jardin ${pr.loc} ?`,
      answer:
        "Je me rends chez vous pour observer le jardin, écouter vos besoins et vous donner des recommandations claires. La visite dure au moins une heure et se prolonge par un compte-rendu écrit envoyé par e-mail.",
    },
    {
      question: "La visite conseil est-elle utile avant un projet de création ?",
      answer:
        "Oui, c'est souvent la première étape : elle permet de définir ce qui est réalisable, dans quel ordre, et d'éviter des erreurs coûteuses sur le choix des plantes ou de l'arrosage.",
    },
    {
      question: "Dois-je être présent pendant la visite ?",
      answer:
        "Votre présence est recommandée : c'est ce qui me permet de comprendre vos habitudes et vos attentes, et de vous répondre directement.",
    },
    {
      question: "La visite conseil m'engage-t-elle à faire des travaux ?",
      answer:
        "Non. C'est un temps de conseil. Vous êtes libre de mettre en œuvre les recommandations vous-même, de les confier à un autre professionnel ou de me proposer de poursuivre ensemble.",
    },
    {
      question: "Pouvez-vous m'aider si mes plantes dépérissent ?",
      answer:
        "C'est un cas fréquent. Sur place, on identifie souvent la cause : exposition, arrosage inadapté, sol trop lourd ou trop pauvre. Le compte-rendu précise ce qu'il faut corriger.",
    },
    {
      question: `Intervenez-vous partout ${pr.loc} ?`,
      answer: `Je me déplace chez les particuliers de ${pr.name} et des communes voisines. Si vous avez un doute sur la zone, décrivez-moi votre adresse dans le formulaire de contact.`,
    },
  ];

  return {
    intro,
    fixed,
    floating,
    faqPool,
    faqCount: 4,
    cta: {
      h2: r.pick([`Planifier une visite conseil ${pr.loc}`, `Une visite chez vous, ${pr.loc}`]),
      text: r.pick([
        "Indiquez-moi votre adresse et ce qui vous préoccupe dans votre jardin : je vous propose un rendez-vous.",
        "Dites-moi en quelques lignes ce que vous aimeriez améliorer : nous fixons ensuite une date pour la visite.",
      ]),
    },
  };
}

/* -------------------------------------------------------------------------------------------------- */
/* Entretien                                                                                          */
/* -------------------------------------------------------------------------------------------------- */
export function composeSap(c: Ctx): Composition {
  const { p: pr, r } = c;
  const intro = [
    r.pick([
      `Faire entretenir son jardin ${pr.loc}, c'est lui offrir des passages réguliers, adaptés à la saison et à ce qu'il demande vraiment. ${c.business} assure cet entretien chez les particuliers, avec des gestes choisis pour les jardins méditerranéens.`,
      `Un jardin entretenu à la bonne cadence demande moins d'efforts qu'un jardin que l'on rattrape une fois par an. Je m'occupe de l'entretien de jardins de particuliers ${pr.loc} et dans les communes voisines.`,
    ]),
    identityParagraph(c),
  ];

  const fixed: Block[] = [
    {
      h2: r.pick([`Un entretien pensé pour ${pr.name}`, "Un entretien adapté au climat"]),
      parts: [p(climate(c)), p(r.pickN(pr.gardens, 2).join(" "))],
    },
  ];

  const floating: Block[] = [
    {
      h2: r.pick(["Ce que comprend un passage", "Les gestes d'un entretien régulier"]),
      parts: [
        {
          ul: r.pickN(
            [
              "Taille des arbustes, des haies et des rosiers au moment qui leur convient.",
              "Désherbage et entretien des massifs.",
              "Paillage, à renouveler quand il s'amenuise.",
              "Contrôle de l'arrosage automatique et du goutte-à-goutte.",
              "Conseils pour accompagner le jardin au fil des saisons.",
              "Tonte ou entretien de la pelouse, quand il y en a une.",
              "Ramassage des feuilles et des tailles, selon ce que nous avons convenu.",
              "Surveillance des plantes fragiles et signalement de ce qui souffre.",
            ],
            5,
          ),
        },
      ],
    },
    {
      h2: r.pick(["Un calendrier qui suit les saisons", "L'entretien, saison par saison"]),
      parts: [
        {
          ul: [
            r.pick([
              "Automne : plantations, taille des arbustes qui ont fini de fleurir, paillage avant les pluies.",
              "À l'automne, c'est la saison des plantations et du paillage, juste avant les pluies.",
            ]),
            r.pick([
              "Hiver : taille des arbres et des haies hors gel, nettoyage des massifs.",
              "En hiver, on taille les arbres et les haies (hors périodes de gel) et on remet les massifs au propre.",
            ]),
            r.pick([
              "Printemps : désherbage, remise en route de l'arrosage, taille légère après floraison.",
              "Au printemps, on désherbe, on relance l'arrosage et on taille légèrement ce qui a fini de fleurir.",
            ]),
            r.pick([
              "Été : surveillance de l'arrosage, arrosage profond des jeunes plantations, taille discrète.",
              "L'été est surtout une saison de surveillance : arrosage des jeunes plantations, repérage des plantes en souffrance.",
            ]),
          ],
        },
      ],
    },
    {
      h2: r.pick(["Tailler au bon moment", "La taille, une question de calendrier"]),
      parts: [
        p(
          r.pick([
            "Chaque végétal a sa saison. Les lavandes et les romarins se taillent après la floraison, les oliviers en fin d'hiver, les arbustes à fleurs de printemps juste après qu'elles sont passées. Tailler au mauvais moment, c'est souvent sacrifier les fleurs de l'année suivante.",
            "La taille n'est pas une affaire de sécateur, mais de calendrier : lavandes et romarins après la floraison, oliviers en fin d'hiver, haies de laurier ou de photinia au printemps. C'est ce qui donne un jardin dense sans l'affaiblir.",
          ]),
        ),
        p(
          "Au printemps et au début de l'été, de nombreux oiseaux nichent dans les haies : quand c'est possible, je privilégie les périodes où elles sont libres.",
        ),
      ],
    },
    {
      h2: r.pick(["Et la pelouse ?", "Pelouse : la tondre, l'arroser, ou la remplacer"]),
      parts: [
        p(
          r.pick([
            "Une pelouse est le poste le plus gourmand en eau d'un jardin. Sans la supprimer, on peut la tondre un peu moins ras, l'arroser moins souvent mais plus longtemps, et en réduire la surface au profit de massifs ou de couvre-sols moins exigeants.",
            "Je ne pars jamais du principe qu'il faut retirer la pelouse. En revanche, la tondre haut, éviter les arrosages trop fréquents et accepter qu'elle jaunisse un peu en plein été suffit souvent à la faire durer sans la maintenir sous perfusion.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick(["Le premier passage", "Comment cela commence"]),
      parts: [
        {
          ol: [
            "Une visite sur place pour faire le tour du jardin, repérer ses points forts et ce qui demande de l'attention.",
            "Un rythme de passage et une liste de gestes adaptés, que nous fixons ensemble.",
            "Un premier passage, puis un point après quelques semaines pour ajuster.",
          ],
        },
      ],
    },
    {
      h2: "Une aide fiscale, sous conditions",
      parts: [
        p(
          "Pour les particuliers, les travaux d'entretien du jardin peuvent ouvrir droit à une avance immédiate de crédit d'impôt, sous conditions. Selon votre situation, je vous explique comment cela fonctionne avant le premier passage.",
        ),
      ],
    },
    {
      h2: r.pick(["Quel rythme de passage ?", "Choisir la bonne fréquence"]),
      parts: [
        p(
          r.pick([
            "Le rythme dépend du jardin et de la saison : un passage par mois convient à beaucoup de jardins, certains préfèrent des visites saisonnières. Nous le fixons ensemble après une première visite, et nous pouvons l'ajuster.",
            "Il n'y a pas de rythme idéal pour tout le monde. Je propose une fréquence adaptée à la taille du jardin, aux plantations et à vos envies, et je la revois si le jardin évolue.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick([`Intervention ${pr.loc} et alentours`, "Où j'interviens"]),
      parts: [
        p(
          `L'entreprise est installée à Vendargues. Pour l'entretien régulier, la proximité compte : ${pr.name} fait partie de mon secteur, comme ${neighbours(c)}.`,
        ),
      ],
    },
  ];

  const faqPool: FaqItem[] = [
    {
      question: `À quelle fréquence faire entretenir son jardin ${pr.loc} ?`,
      answer:
        "Le rythme dépend du jardin et de la saison. Il est défini avec vous après une première visite : mensuel, saisonnier ou plus ponctuel.",
    },
    {
      question: "L'entretien est-il adapté à un jardin méditerranéen ?",
      answer:
        "Oui. Les gestes sont choisis pour respecter des végétaux habitués à la sécheresse : taille douce, paillage, arrosage maîtrisé, pas de traitements inutiles.",
    },
    {
      question: "Peut-on bénéficier d'une aide fiscale pour l'entretien du jardin ?",
      answer:
        "Pour les particuliers, certains travaux d'entretien du jardin peuvent donner droit à un crédit d'impôt, sous conditions. Je vous indique ce qui s'applique à votre situation.",
    },
    {
      question: "Intervenez-vous si mon jardin n'a pas été entretenu depuis longtemps ?",
      answer:
        "Oui. Je commence par une remise en état si nécessaire, puis je passe à un entretien régulier plus léger.",
    },
    {
      question: "Mon jardin a un arrosage automatique : le vérifiez-vous aussi ?",
      answer:
        "Oui, je contrôle le fonctionnement de l'arrosage à chaque saison et je signale ce qui doit être réparé ou réglé.",
    },
    {
      question: `Peut-on tondre et tailler en plein été ${pr.loc} ?`,
      answer:
        "On évite les grosses tailles en pleine chaleur, qui fragilisent les végétaux. En été, on se limite à des tailles légères, on tond un peu plus haut et on surveille surtout l'arrosage.",
    },
    {
      question: "Que se passe-t-il si je suis absent plusieurs semaines ?",
      answer:
        "Le passage est justement utile dans ce cas : il permet de surveiller l'arrosage et de garder le jardin en ordre pendant votre absence. Nous en parlons à l'avance pour adapter le calendrier.",
    },
    {
      question: `Faut-il garder la pelouse dans un jardin ${pr.loc} ?`,
      answer:
        "Ce n'est pas obligatoire. On peut la conserver sur une surface réduite, la tondre plus haut et l'arroser moins souvent, ou la remplacer partiellement par des couvre-sols moins exigeants.",
    },
  ];

  return {
    intro,
    fixed,
    floating,
    faqPool,
    faqCount: 5,
    cta: {
      h2: r.pick([
        `Parler de l'entretien de votre jardin ${pr.loc}`,
        `Un jardin à entretenir ${pr.loc} ?`,
      ]),
      text: "Décrivez-moi votre jardin et le rythme qui vous conviendrait : je vous réponds pour convenir d'une première visite.",
    },
  };
}

/* -------------------------------------------------------------------------------------------------- */
/* Remise en état                                                                                     */
/* -------------------------------------------------------------------------------------------------- */
export function composeRemise(c: Ctx): Composition {
  const { p: pr, r } = c;
  const intro = [
    r.pick([
      `Un jardin laissé quelques saisons sans soin peut se refermer très vite. ${c.business} remet en état les jardins négligés ${pr.loc} et dans les communes voisines : nettoyage, taille de remise en forme et préparation d'un jardin que l'on pourra ensuite entretenir sans peine.`,
      `Jardin envahi, haies qui ont pris le dessus, terrasse perdue sous les herbes : une remise en état permet de retrouver un jardin accessible et d'envisager la suite. C'est un travail que je réalise ${pr.loc} chez les particuliers.`,
    ]),
    identityParagraph(c),
  ];

  const fixed: Block[] = [
    {
      h2: r.pick(["Pourquoi remettre un jardin en état", "Repartir sur de bonnes bases"]),
      parts: [
        p(climate(c)),
        p(
          `Au printemps, la végétation méditerranéenne repart très vite : un jardin abandonné une saison devient difficile à reprendre la suivante. ${r.pick(pr.gardens)}`,
        ),
      ],
    },
  ];

  const floating: Block[] = [
    {
      h2: r.pick(["Comment je travaille", "De l'état des lieux à la remise en forme"]),
      parts: [
        {
          ol: [
            r.pick([
              "Visite sur place pour évaluer l'état du jardin : ce qui peut être sauvé, ce qui doit être taillé ou retiré.",
              "Je viens voir le jardin avec vous : nous repérons ce qui mérite d'être gardé, taillé ou retiré.",
            ]),
            r.pick([
              "Définition des priorités avec vous, et du niveau d'intervention souhaité.",
              "Nous fixons ensemble les priorités et jusqu'où aller dans la remise en forme.",
            ]),
            r.pick([
              "Intervention : nettoyage, taille de remise en forme, remise en ordre des massifs.",
              "Réalisation du chantier : nettoyage, tailles de remise en forme, massifs remis en ordre.",
            ]),
            r.pick([
              "Conseils pour la suite : entretien régulier, nouvelles plantations ou projet d'aménagement.",
              "Je vous explique ce qui peut suivre : entretien régulier, nouvelles plantations ou véritable projet d'aménagement.",
            ]),
          ],
        },
      ],
    },
    {
      h2: r.pick(["Évaluer ce qui peut être sauvé", "Tout n'est pas à retirer"]),
      parts: [
        p(
          r.pick([
            "Avant de couper quoi que ce soit, je regarde ce qui est encore vivant : un arbre qui a de la ressource, des vivaces qui repartiront, un muret ou un massif que l'on retrouve sous les herbes. Une remise en état n'est pas un nettoyage à blanc.",
            "Ce que l'on croit perdu l'est rarement tout à fait. Beaucoup d'arbustes de type méditerranéen repartent après une taille de remise en forme, à condition de la faire au bon moment et sans les affaiblir.",
          ]),
        ),
        p(r.pickN(pr.gardens, 2).join(" ")),
      ],
    },
    {
      h2: r.pick(["Tout couper d'un coup ?", "Procéder par étapes"]),
      parts: [
        p(
          "Selon l'état du jardin, il est parfois préférable d'intervenir en plusieurs temps : les gros volumes d'abord, puis les tailles plus fines à la bonne saison. Cela ménage les végétaux et limite le choc pour le sol.",
        ),
        p(
          "Au printemps et au début de l'été, de nombreux oiseaux nichent dans les haies et les arbustes : j'en tiens compte dans le calendrier d'intervention.",
        ),
      ],
    },
    {
      h2: r.pick([
        "Éviter que le jardin ne se referme à nouveau",
        "Garder le jardin ouvert une fois remis en état",
      ]),
      parts: [
        p(
          r.pick([
            "Un paillage épais, un arrosage réglé et quelques végétaux couvrants suffisent souvent à empêcher les herbes de revenir en force. Ce sont ces gestes, plus que la taille elle-même, qui font durer le résultat.",
            "La meilleure remise en état est celle qui ne sera pas à refaire. Couvrir le sol, simplifier l'arrosage et prévoir un passage régulier évitent que le jardin ne reparte dans tous les sens.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick(["Et après ?", "Ce que cela permet"]),
      parts: [
        p(
          r.pick([
            "Une fois le jardin remis en état, on peut passer à un entretien régulier, nettement plus léger que le chantier de départ, ou envisager un nouvel aménagement.",
            "La remise en état est souvent une étape avant autre chose : un entretien suivi, un projet de création ou de rénovation du jardin. Je vous en parle à la fin de l'intervention.",
          ]),
        ),
      ],
    },
    {
      h2: r.pick([`Intervention ${pr.loc} et alentours`, "Où j'interviens"]),
      parts: [
        p(
          `L'entreprise est installée à Vendargues. ${pr.name} est dans mon secteur de travail, avec ${neighbours(c)}.`,
        ),
      ],
    },
  ];

  const faqPool: FaqItem[] = [
    {
      question: `Que comprend la remise en état d'un jardin ${pr.loc} ?`,
      answer:
        "Elle comprend l'évaluation du jardin, le nettoyage, la taille nécessaire et la remise en ordre des massifs. Le détail est précisé après la visite sur place.",
    },
    {
      question: "Peut-on enchaîner avec un entretien régulier ?",
      answer:
        "Oui, c'est fréquent : une fois le jardin remis en état, un entretien suivi est plus simple et moins coûteux en efforts qu'un nouveau rattrapage.",
    },
    {
      question: "Que devient ce qui est retiré du jardin ?",
      answer:
        "Cela dépend de la nature et de la quantité de ce qui est retiré. Nous en parlons lors de la visite, avant toute intervention.",
    },
    {
      question: "Faut-il être présent pendant l'intervention ?",
      answer:
        "Ce n'est pas indispensable une fois les priorités définies, mais votre présence est utile lors de la visite préalable et à la fin du chantier.",
    },
    {
      question: `Quelle est la bonne saison pour remettre un jardin en état ${pr.loc} ?`,
      answer:
        "Cela dépend de l'état du jardin et de ce que l'on doit tailler. Les grosses tailles se font plutôt à la saison fraîche, hors période de nidification, et les nettoyages peuvent avoir lieu presque toute l'année.",
    },
    {
      question: "Les plantes qui semblent mortes peuvent-elles repartir ?",
      answer:
        "Souvent oui, surtout les arbustes méditerranéens. On vérifie la vitalité du bois avant de décider : un gratté léger sur une branche suffit à voir s'il y a encore de la vie.",
    },
    {
      question: `Mon jardin ${pr.loc} est très envahi : par où commencer ?`,
      answer:
        "Par une visite. Elle permet de repérer l'essentiel, de fixer les priorités et d'organiser le chantier par étapes, pour que le résultat dure.",
    },
  ];

  return {
    intro,
    fixed,
    floating,
    faqPool,
    faqCount: 4,
    cta: {
      h2: r.pick([
        `Demander une visite pour votre jardin ${pr.loc}`,
        `Un jardin à reprendre ${pr.loc} ?`,
      ]),
      text: "Décrivez-moi l'état du jardin en quelques lignes : je vous propose une visite pour évaluer ce qu'il faut faire.",
    },
  };
}
