// Assistant AP — catalogue fournisseurs : règles d'association fourniture → fournisseur.
// Logique pure (aucun accès réseau). Ordre de priorité :
//   1. mémoire des associations manuelles (ap_supplier_memory)
//   2. règles du catalogue (spécificités avant règles générales)
//   3. historique déjà saisi dans Assistant AP (association dominante)
// Si rien n'est sûr, le fournisseur reste vide : la fourniture est quand même créée.

export type SupplyCategory =
  | "vegetal"
  | "terre"
  | "amendement_paillage"
  | "materiaux"
  | "fixation"
  | "irrigation"
  | "autre";

export interface QuoteLine {
  item: string;
  quantity: string | null;
  category: SupplyCategory;
  plant_type: string | null;
  plant_liters: number | null;
  /** Fournisseur écrit dans le devis (ex. « AEF » dans la désignation) : prioritaire. */
  supplier_tag?: string | null;
}

export interface SupplierRef {
  id: string;
  name: string;
  aliases?: string[] | null;
}

export type SupplierKey =
  | "berger"
  | "touchat"
  | "aef"
  | "sj34"
  | "ruiz"
  | "pc"
  | "lrm"
  | "granier"
  | "dmd";

const SUPPLIER_NAMES: Record<SupplierKey, string[]> = {
  berger: ["b&f", "berger et fils", "berger"],
  touchat: ["touchat"],
  aef: ["aef", "arc en fleurs", "arc-en-fleurs"],
  sj34: ["sj34"],
  ruiz: ["ruiz"],
  pc: ["pc", "pousse-clanet", "pousse clanet"],
  lrm: ["lr merlin", "leroy merlin"],
  granier: ["granier"],
  dmd: ["dmd"],
};

const DISPLAY: Record<SupplierKey, string> = {
  berger: "Berger et fils",
  touchat: "Touchat",
  aef: "AEF",
  sj34: "SJ34",
  ruiz: "Ruiz",
  pc: "PC",
  lrm: "LR Merlin",
  granier: "Granier",
  dmd: "DMD",
};

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normText(value: string): string {
  return stripAccents(value)
    .toLocaleLowerCase("fr-FR")
    .replace(/[œ]/g, "oe")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "un",
  "une",
  "et",
  "en",
  "pour",
  "avec",
  "sac",
  "sacs",
]);

/** Mots significatifs d'une fourniture (sans quantités, tailles, ni pluriels). */
export function itemTokens(item: string): string[] {
  return normText(item)
    .replace(/\d+([.,]\d+)?/g, " ")
    .replace(/[^a-z& -]+/g, " ")
    .split(/[\s-]+/)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^(x|kg|l|ml|cm|mm|m|ml|c|h)$/.test(w));
}

export function normKey(item: string): string {
  return itemTokens(item).sort().join(" ");
}

function supplierKeyOf(ref: SupplierRef): SupplierKey | null {
  const names = [ref.name, ...(ref.aliases ?? [])].map(normText);
  for (const key of Object.keys(SUPPLIER_NAMES) as SupplierKey[]) {
    if (SUPPLIER_NAMES[key].some((n) => names.includes(normText(n)))) return key;
  }
  return null;
}

export function findSupplier(suppliers: SupplierRef[], key: SupplierKey): SupplierRef | undefined {
  return suppliers.find((s) => supplierKeyOf(s) === key);
}

/** Retrouve un fournisseur du catalogue à partir d'un nom saisi à la main (nom ou alias exact). */
export function supplierByName<T extends SupplierRef>(suppliers: T[], name: string): T | undefined {
  const wanted = normText(name);
  if (!wanted) return undefined;
  return suppliers.find((s) => [s.name, ...(s.aliases ?? [])].some((n) => normText(n) === wanted));
}

export interface MemoryEntry {
  norm_key: string;
  supplier_id: string;
  hits: number;
}
export interface HistoryEntry {
  item: string;
  supplier_id: string | null;
  supplier?: string | null;
}

export interface MatchContext {
  suppliers: SupplierRef[];
  memory: MemoryEntry[];
  history: HistoryEntry[];
}

export interface MatchResult {
  supplier: SupplierRef | null;
  source: "memoire" | "catalogue" | "historique" | null;
  /** Fournisseurs possibles quand la règle n'en désigne pas un seul (reste alors vide). */
  candidates: string[];
}

type Rule = { key: SupplierKey } | { candidates: SupplierKey[] } | null;

function plantLiters(line: QuoteLine, t: string): number | null {
  if (line.plant_liters != null && Number.isFinite(line.plant_liters)) return line.plant_liters;
  const l = t.match(/(\d+(?:[.,]\d+)?)\s*l\b/);
  if (l) return Number(l[1].replace(",", "."));
  const c = t.match(/\bc\s?(\d+)\b/);
  if (c) return Number(c[1]);
  if (/godet/.test(t)) return 0.5;
  return null;
}

/** Règles du catalogue — les spécificités passent avant les règles générales. */
export function catalogueRule(line: QuoteLine): Rule {
  const t = normText(`${line.item} ${line.plant_type ?? ""}`);
  const has = (re: RegExp) => re.test(t);

  // Spécificités
  if (has(/terreau/) && has(/compos/)) return { key: "pc" };
  if (has(/terreau/) && has(/\bbio/)) return { key: has(/profession/) ? "touchat" : "sj34" };
  if (has(/terre vegetale/) && has(/\bbio/)) return { key: "sj34" };
  if (has(/haie/) && has(/\bh\s?[123]\b/)) return { key: "sj34" };

  // Tout ce qui concerne l'arrosage : DMD
  if (
    line.category === "irrigation" ||
    has(
      /goutteur|goutte a goutte|capillaire|tuyau|\bpe\b|crampon|asperseur|varijet|bouchon|arrosage|irrigation|electrovanne|programmateur|raccord|jonction|embout|vanne|filtre|reducteur|nourrice|enrouleur|collier de prise/,
    )
  )
    return { key: "dmd" };

  // Règles générales
  if (has(/terre vegetale/)) return { key: "berger" };
  if (has(/amendement|paillage|paillis|ganivelle|terreau/)) return { key: "touchat" };
  if (has(/canisse|fixation|visserie|crochet|attache/)) return { key: "lrm" };
  if (has(/traverse|gravier|sable|pas japonais|dallage|dalle\b|bordure|ecolat|corten/))
    return { key: "granier" };

  if (line.category === "vegetal" || has(/arbuste|grimpante|arbre|vivace|plante|haie/)) {
    const liters = plantLiters(line, t);
    if (liters != null && liters < 3) return { key: "aef" };
    if (liters == null && /vivace/.test(t)) return { key: "aef" };
    if (liters != null && liters <= 5) return { candidates: ["aef", "pc", "sj34"] };
    return { candidates: ["sj34", "ruiz", "pc"] };
  }
  return null;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Même mot, à une faute de frappe près pour les mots d'au moins 6 lettres. */
function sameToken(a: string, b: string): boolean {
  return a === b || (a.length >= 6 && b.length >= 6 && editDistanceAtMostOne(a, b));
}

interface LookupHit {
  id: string;
  n: number;
  total: number;
}

function lookup(
  entries: { key: string; counts: Map<string, number> }[],
  tokens: string[],
  minShare: number,
): LookupHit | null {
  if (tokens.length === 0) return null;
  const key = [...tokens].sort().join(" ");
  let best: { key: string; counts: Map<string, number> } | null = null;
  for (const entry of entries) {
    if (entry.key === key) {
      best = entry;
      break;
    }
    const entryTokens = entry.key.split(" ").filter(Boolean);
    const ok =
      entryTokens.length > 0 &&
      entryTokens.every((w) => tokens.some((t) => sameToken(t, w))) &&
      (entryTokens.length >= 2 || entry.key.length >= 5);
    if (ok && (!best || entry.key.length > best.key.length)) best = entry;
  }
  if (!best) return null;
  const total = [...best.counts.values()].reduce((a, b) => a + b, 0);
  const [id, n] = [...best.counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return n / total >= minShare ? { id, n, total } : null;
}

function buildEntries(rows: { key: string; supplier_id: string; n: number }[]) {
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.key) continue;
    const counts = map.get(r.key) ?? new Map<string, number>();
    counts.set(r.supplier_id, (counts.get(r.supplier_id) ?? 0) + r.n);
    map.set(r.key, counts);
  }
  return [...map.entries()].map(([key, counts]) => ({ key, counts }));
}

export function matchSupplier(line: QuoteLine, ctx: MatchContext): MatchResult {
  const byId = new Map(ctx.suppliers.map((s) => [s.id, s]));
  const tokens = itemTokens(line.item);

  // 0. Fournisseur explicitement indiqué dans le devis.
  if (line.supplier_tag) {
    const tagged = supplierByName(ctx.suppliers, line.supplier_tag);
    if (tagged) return { supplier: tagged, source: "catalogue", candidates: [] };
  }

  // 1. Mémoire des associations manuelles.
  const memoryHit = lookup(
    buildEntries(
      ctx.memory.map((m) => ({ key: m.norm_key, supplier_id: m.supplier_id, n: m.hits })),
    ),
    tokens,
    0.5,
  );
  if (memoryHit && byId.has(memoryHit.id))
    return { supplier: byId.get(memoryHit.id)!, source: "memoire", candidates: [] };

  // Historique d'Assistant AP : fiches déjà saisies (fournisseur lié ou reconnu par son nom).
  const historyRows: { key: string; supplier_id: string; n: number }[] = [];
  for (const h of ctx.history) {
    const id = h.supplier_id ?? supplierByName(ctx.suppliers, h.supplier ?? "")?.id;
    if (id) historyRows.push({ key: normKey(h.item), supplier_id: id, n: 1 });
  }
  const historyHit = lookup(buildEntries(historyRows), tokens, 0.7);
  const historySupplier = historyHit ? byId.get(historyHit.id) : undefined;

  // 2. Pratique constante de l'historique (≥ 2 fiches, ≥ 80 %) : elle prime sur le catalogue.
  if (historyHit && historySupplier && historyHit.n >= 2 && historyHit.n / historyHit.total >= 0.8)
    return { supplier: historySupplier, source: "historique", candidates: [] };

  // 3. Catalogue.
  const rule = catalogueRule(line);
  let candidates: string[] = [];
  if (rule && "key" in rule) {
    const supplier = findSupplier(ctx.suppliers, rule.key);
    if (supplier) return { supplier, source: "catalogue", candidates: [] };
  } else if (rule) {
    candidates = rule.candidates.map((k) => findSupplier(ctx.suppliers, k)?.name ?? DISPLAY[k]);
  }

  // 4. Historique moins tranché (au moins 70 %), compatible avec les fournisseurs possibles.
  if (historySupplier && (candidates.length === 0 || candidates.includes(historySupplier.name)))
    return { supplier: historySupplier, source: "historique", candidates: [] };

  return { supplier: null, source: null, candidates };
}
