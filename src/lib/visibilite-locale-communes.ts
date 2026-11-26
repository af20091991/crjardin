/**
 * Radar — fiches communes utilisées pour rédiger les pages locales.
 * Les faits chiffrés (altitude, superficie, densité, évolution de la population, type d'habitat)
 * proviennent de sources publiques (INSEE via Wikipédia et villesavivre.fr, consultées le 25/10/2026).
 * Les observations sur les jardins sont formulées avec prudence (« souvent », « fréquemment ») :
 * ce sont des situations courantes, pas des constats sur des jardins précis.
 */

export type Setting = "dense" | "recent" | "relief" | "plaine";

export interface CommuneProfile {
  name: string;
  /** « à Castries », « au Crès » */
  loc: string;
  /** « de Castries », « du Crès » */
  de: string;
  setting: Setting;
  /** Faits vérifiés, formulés en phrases. */
  identity: string[];
  /** Situations de jardin courantes dans la commune (formulations prudentes). */
  gardens: string[];
  /** Végétaux particulièrement adaptés à cette situation, mis en avant en premier. */
  plantFocus: string[];
  /** Difficulté principale, utilisée dans les titres et conclusions. */
  challenge: string;
}

export const PROFILES: Record<string, CommuneProfile> = {
  "Saint-Aunès": {
    name: "Saint-Aunès",
    loc: "à Saint-Aunès",
    de: "de Saint-Aunès",
    setting: "plaine",
    identity: [
      "Saint-Aunès s'étend dans la plaine à l'est de Montpellier, à une altitude comprise entre 13 et 60 mètres.",
      "Avec un peu plus de 4 500 habitants, c'est un village qui a gardé une taille humaine, avec sa gare, son église et des jardins que l'on voit encore beaucoup depuis la rue.",
      "La commune couvre un peu plus de 12 km² : de la place pour de vrais jardins, et pas seulement des terrasses.",
    ],
    gardens: [
      "Sur un terrain aussi plat, l'eau des pluies d'automne a tendance à stagner dans les sols les plus lourds, alors que l'été les dessèche en profondeur : ce sont ces deux extrêmes qu'il faut anticiper dès la conception.",
      "Sans relief pour freiner le vent, un brise-vent végétal bien placé change vite le confort d'une terrasse ou d'un coin repas.",
      "Beaucoup de jardins y sont ceux de maisons individuelles, ouverts sur la rue ou sur les voisins : la question de l'intimité se pose presque toujours.",
    ],
    plantFocus: ["cistes", "romarins", "achillées", "lavandes", "oliviers"],
    challenge: "l'eau qui stagne l'hiver et qui manque l'été",
  },
  Castries: {
    name: "Castries",
    loc: "à Castries",
    de: "de Castries",
    setting: "recent",
    identity: [
      "Castries compte environ 6 900 habitants et fait partie de Montpellier Méditerranée Métropole.",
      "Sept logements sur dix y sont des maisons, et près des deux tiers des habitants en sont propriétaires : ici, le jardin est d'abord un jardin de famille, que l'on aménage pour qu'il dure.",
      "Le soleil y est généreux, autour de 2 700 heures par an, avec une cinquantaine de journées au-dessus de 30 °C chaque été.",
    ],
    gardens: [
      "Environ trois logements sur quatre datent d'après 1970 : beaucoup de jardins sont ceux de lotissements, avec un sol que le chantier de construction a souvent tassé, voire remblayé.",
      "Pelouse très gourmande en eau, haie de thuyas ou de lauriers qui a pris trop de place, terrasse sans ombre : ce sont des situations très courantes dans ce type de jardin.",
      "Avec des logements de quatre pièces et plus dans la grande majorité des cas, les parcelles laissent en général assez de place pour composer plusieurs espaces : un coin d'ombre, un massif, un passage.",
    ],
    plantFocus: ["oliviers", "cistes", "gattilier", "lavandes", "arbousier"],
    challenge: "un sol tassé par la construction et une pelouse trop assoiffée",
  },
  Vendargues: {
    name: "Vendargues",
    loc: "à Vendargues",
    de: "de Vendargues",
    setting: "recent",
    identity: [
      "Vendargues est la commune où l'entreprise est installée : je connais ses rues, ses sols et son exposition au quotidien.",
      "Environ 7 300 habitants vivent sur moins de 9 km², entre 25 et 86 mètres d'altitude, sur un relief doux qui laisse de bonnes expositions au soleil.",
    ],
    gardens: [
      "Entre le centre ancien et les quartiers résidentiels plus récents, les jardins vont du petit patio à la parcelle de pavillon.",
      "Avec environ 800 habitants au km², l'espace est compté : chaque mètre carré de jardin doit avoir un usage ou un intérêt, et la composition compte autant que le choix des plantes.",
      "Ce relief doux crée parfois de légères différences d'exposition d'un jardin à l'autre : une même plante peut s'y plaire à un endroit et souffrir à vingt mètres.",
    ],
    plantFocus: ["lavandes", "santolines", "romarins", "oliviers", "sauge de Jérusalem"],
    challenge: "un espace compté et des expositions qui varient d'un jardin à l'autre",
  },
  Baillargues: {
    name: "Baillargues",
    loc: "à Baillargues",
    de: "de Baillargues",
    setting: "recent",
    identity: [
      "Baillargues est passée d'à peine 1 300 habitants en 1968 à près de 7 800 aujourd'hui : en un demi-siècle, la commune a changé d'échelle.",
      "Sa gare la relie à Montpellier, Narbonne et Avignon, et la place de l'église garde le cœur du village, avec une altitude de 12 à 58 mètres sur à peine 7,7 km².",
    ],
    gardens: [
      "Une croissance aussi rapide s'est faite en grande partie par quartiers de maisons récents : les jardins sont jeunes, les arbres souvent petits et l'ombre encore rare.",
      "Dans une plaine aussi ouverte, l'été est rude pour les plantations fraîchement installées, et c'est le moment où un goutte-à-goutte bien réglé fait toute la différence.",
      "Dans les quartiers où les parcelles sont resserrées, on gagne beaucoup à penser le jardin par petits espaces plutôt que comme une seule pelouse.",
    ],
    plantFocus: ["gattilier", "cistes", "perovskia", "lavandes", "arbousier"],
    challenge: "des jardins récents où l'ombre n'a pas encore eu le temps de se former",
  },
  Jacou: {
    name: "Jacou",
    loc: "à Jacou",
    de: "de Jacou",
    setting: "dense",
    identity: [
      "Jacou se trouve à environ 7 km au nord du centre de Montpellier, entre Clapiers, Castelnau-le-Lez, Le Crès et Teyran.",
      "Près de 7 000 habitants sur à peine 3,4 km² : c'est l'une des communes les plus densément peuplées de ma zone d'intervention, avec une altitude moyenne d'environ 68 mètres.",
      "Le soleil y compte environ 2 600 heures par an, et l'été y est chaud, avec peu de pluie.",
    ],
    gardens: [
      "Dans une commune aussi dense, les jardins sont souvent de taille modeste, parfois réduits à une terrasse ou à une cour, et la vue des voisins est fréquente.",
      "Sur de petites surfaces, chaque plante compte : un arbuste bien choisi peut créer l'intimité qu'une haie large ne permettrait pas.",
      "Quand la surface est limitée, bacs, pots et massifs étroits deviennent des outils à part entière, à condition d'être pensés pour l'arrosage et pour l'ombre qu'ils reçoivent.",
    ],
    plantFocus: ["santolines", "romarins", "lavandes", "cistes", "myrte"],
    challenge: "de petites surfaces, des vis-à-vis et un besoin d'intimité",
  },
  Clapiers: {
    name: "Clapiers",
    loc: "à Clapiers",
    de: "de Clapiers",
    setting: "relief",
    identity: [
      "Clapiers comptait 307 habitants en 1901 et en compte aujourd'hui environ 6 000, l'essentiel de cette croissance datant des années 1970 et suivantes.",
      "Son altitude varie de 25 à 126 mètres : c'est la commune de ma zone d'intervention où le relief se fait le plus sentir.",
    ],
    gardens: [
      "Sur un terrain en pente, l'eau des pluies d'automne ruisselle plus vite qu'elle ne s'infiltre : sans précaution, le sol s'érode et les plantations du haut manquent d'eau pendant que celles du bas se noient.",
      "Murets, restanques et paliers prennent ici tout leur sens : ils retiennent la terre, créent des espaces plats utilisables et donnent au jardin sa structure.",
      "Les sols de coteau sont souvent plus caillouteux et plus drainants, ce qui convient très bien aux plantes de garrigue, à condition de ne pas les arroser comme une pelouse.",
    ],
    plantFocus: ["cistes", "romarins", "santolines", "arbousier", "chêne vert"],
    challenge: "la pente, qui fait ruisseler l'eau et fatigue le sol",
  },
  "Castelnau-le-Lez": {
    name: "Castelnau-le-Lez",
    loc: "à Castelnau-le-Lez",
    de: "de Castelnau-le-Lez",
    setting: "dense",
    identity: [
      "Castelnau-le-Lez est la plus peuplée des communes où j'interviens : environ 26 000 habitants sur 11 km², à quelques kilomètres du centre de Montpellier.",
      "Elle doit son nom au Lez, ce petit fleuve côtier qui traverse l'agglomération, et son église Saint-Jean-Baptiste marque l'ancien centre.",
      "Avec plus de 2 300 habitants au km², on est ici dans un cadre franchement urbain : le jardin y est un luxe, et on l'aménage en conséquence.",
    ],
    gardens: [
      "Beaucoup de jardins y sont des jardins de ville : cours, patios, terrasses, petites parcelles entourées de murs, où chaque mètre carré compte.",
      "Entre les murs, la chaleur se réverbère : le sol et les plantes subissent des températures plus élevées qu'en pleine campagne, et l'arrosage doit être pensé en conséquence.",
      "Quand la place manque, on gagne à penser en hauteur : treille, grimpantes, arbustes palissés et bacs étagés apportent volume et intimité sans consommer de surface.",
    ],
    plantFocus: ["jasmin étoilé", "lavandes", "santolines", "olivier en bac", "myrte"],
    challenge: "la chaleur réverbérée par les murs et le manque de place",
  },
  "Le Crès": {
    name: "Le Crès",
    loc: "au Crès",
    de: "du Crès",
    setting: "dense",
    identity: [
      "Le Crès compte environ 9 200 habitants sur moins de 6 km², entre 29 et 83 mètres d'altitude, à l'est de Jacou et de Castelnau-le-Lez.",
      "C'est une commune qui vit : stades, établissement scolaire, et chaque année une fête de village où les taureaux ont leur place dans la rue comme dans l'arène.",
    ],
    gardens: [
      "Avec environ 1 600 habitants au km², les jardins sont de taille moyenne à petite, souvent séparés par des clôtures ou des haies mitoyennes.",
      "Ces haies, plantées il y a longtemps pour s'isoler, ont souvent pris trop d'ampleur ou se dégarnissent : leur renouvellement est l'un des chantiers les plus fréquents.",
      "Dans un lotissement, on peut vite se retrouver avec un jardin carré et sans relief : travailler les niveaux, les courbes et les hauteurs lui donne tout de suite du caractère.",
    ],
    plantFocus: ["lavandes", "cistes", "romarins", "oliviers", "viorne tin"],
    challenge: "des haies mitoyennes vieillissantes et des terrains sans relief",
  },
};

/** Générateur pseudo-aléatoire déterministe : une même page donne toujours le même texte. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rand {
  private state: number;
  constructor(seed: string) {
    this.state = hash(seed) || 1;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  pickN<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, n);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
