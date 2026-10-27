// Assistant AP — liste exhaustive des végétaux d'un devis, regroupée par taille de conteneur.
// Logique pure : les noms viennent des lignes de description des blocs du devis (IA, ou
// heuristique de repli) et sont reportés dans le commentaire de la fiche de chaque taille.
import { normText, type QuoteLine } from "@/lib/assistant-ap-catalogue";
import type { QuoteBlock } from "@/lib/assistant-ap-quote";

export interface NamedPlant {
  name: string;
  /** null = quantité non précisée dans le devis. */
  quantity: number | null;
  /** group_key de la taille de conteneur concernée ; null = répartition à confirmer. */
  size_key: string | null;
}

/** Payload envoyé à l'IA : une entrée par bloc, tailles identifiées par s0, s1… */
export interface PlantAiBlock {
  id: number;
  lines: string[];
  sizes: { key: string; label: string; quantity: number }[];
}

export function plantAiPayload(blocks: QuoteBlock[]): PlantAiBlock[] {
  return blocks.map((block, id) => ({
    id,
    lines: block.lines.slice(0, 40),
    sizes: block.rows.map((row, i) => ({
      key: `s${i}`,
      label: row.item,
      quantity: row.quantity,
    })),
  }));
}

/** Remet en forme la réponse brute de l'IA (clés s0… → group_key) ; une taille unique est déduite. */
export function normalizeAiPlants(raw: unknown, blocks: QuoteBlock[]): NamedPlant[][] {
  const list = Array.isArray((raw as { blocks?: unknown })?.blocks)
    ? ((raw as { blocks: unknown[] }).blocks as Record<string, unknown>[])
    : [];
  return blocks.map((block, id) => {
    const entry = list.find((b) => Number(b.id) === id);
    const plants = Array.isArray(entry?.plants) ? (entry!.plants as Record<string, unknown>[]) : [];
    const out: NamedPlant[] = [];
    for (const p of plants) {
      const name = typeof p.name === "string" ? p.name.replace(/\s+/g, " ").trim() : "";
      if (!name) continue;
      const q = typeof p.quantity === "number" ? p.quantity : Number(p.quantity);
      const sizeIndex = /^s(\d+)$/.exec(String(p.size_key ?? ""));
      const row = sizeIndex ? block.rows[Number(sizeIndex[1])] : undefined;
      out.push({
        name,
        quantity: Number.isFinite(q) && q > 0 ? q : null,
        size_key: block.rows.length === 1 ? block.rows[0].key : (row?.key ?? null),
      });
    }
    return out;
  });
}

const HEADING_RE =
  /massif|plantation|am[eé]nagement|remplacement|transplantation|densification|rocaille|p[eé]tanque|piscine|banc|terrain|forage|douche|fournitures|mat[eé]riaux|travail du sol|d[eé]sherbage|installation|retrait|arrosage|paillage|goutte|cr[eé]ation|terrasse|pas japonais|bouchage|percage|intervalles|bordure|nord|entr[eé]e|:$/i;

/** Repli sans IA : noms lisibles dans les lignes de description (« 3 agaves », « Yucca rostrata »). */
export function heuristicPlants(block: QuoteBlock): NamedPlant[] {
  const size = block.rows.length === 1 ? block.rows[0].key : null;
  const out: NamedPlant[] = [];
  for (const raw of block.lines) {
    const line = raw.trim();
    if (!line || HEADING_RE.test(line)) continue;
    const counted = /^(\d+)\s+(\p{L}.*)$/u.exec(line);
    if (counted) {
      out.push({ name: counted[2], quantity: Number(counted[1]), size_key: size });
    } else if (/^\p{Lu}/u.test(line) && line.split(/\s+/).length <= 4 && !/\d/.test(line)) {
      out.push({ name: line, quantity: null, size_key: size });
    }
  }
  return out;
}

function capitalise(value: string): string {
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1);
}

interface Accumulated {
  name: string;
  quantity: number;
  unknownQty: boolean;
}

/** Nombre de plants à compter pour un végétal (une quantité non précisée compte pour 1). */
function counted(plant: Accumulated): number {
  return plant.quantity > 0 ? plant.quantity : 1;
}

function addPlant(map: Map<string, Accumulated>, plant: NamedPlant) {
  const key = normText(plant.name);
  const existing = map.get(key);
  if (existing) {
    if (plant.quantity == null) existing.unknownQty = true;
    else existing.quantity += plant.quantity;
  } else {
    map.set(key, {
      name: capitalise(plant.name),
      quantity: plant.quantity ?? 0,
      unknownQty: plant.quantity == null,
    });
  }
}

function formatList(map: Map<string, Accumulated>): string[] {
  return [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "fr-FR"))
    .map((p) => `• ${p.name}${p.quantity > 0 ? ` ×${p.quantity}` : ""}`);
}

function zoneTitle(block: QuoteBlock): string {
  const first = block.lines.find((l) => /:$/.test(l.trim())) ?? block.lines[0] ?? "Zone du devis";
  return first.replace(/:$/, "").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Commentaire par taille de conteneur (clé = group_key) : liste des végétaux nommés dans le devis.
 * Quand une zone plante plusieurs tailles et que le devis ne dit pas laquelle est laquelle, les
 * végétaux de la zone sont signalés « à répartir » sur chacune de ses tailles (sans être comptés).
 */
export function buildPlantComments(
  blocks: QuoteBlock[],
  named: NamedPlant[][],
  lines: QuoteLine[],
): Map<string, string> {
  const assigned = new Map<string, Map<string, Accumulated>>();
  const zones = new Map<string, string[]>();

  blocks.forEach((block, i) => {
    const unsure = new Map<string, Accumulated>();
    for (const plant of named[i] ?? []) {
      const target = plant.size_key ?? null;
      if (target && block.rows.some((r) => r.key === target)) {
        const map = assigned.get(target) ?? new Map<string, Accumulated>();
        addPlant(map, plant);
        assigned.set(target, map);
      } else {
        addPlant(unsure, plant);
      }
    }
    if (unsure.size === 0) return;
    const list = [...unsure.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "fr-FR"))
      .map((p) => `${p.name}${p.quantity > 0 ? ` ×${p.quantity}` : ""}`)
      .join(", ");
    for (const row of block.rows) {
      const others = block.rows.filter((r) => r.key !== row.key).map((r) => r.item);
      const note = `• À répartir — zone « ${zoneTitle(block)} »${
        others.length ? ` (aussi : ${others.join(", ")})` : ""
      } : ${list}`;
      const notes = zones.get(row.key) ?? [];
      notes.push(note);
      zones.set(row.key, notes);
    }
  });

  const out = new Map<string, string>();
  for (const line of lines) {
    const key = line.group_key;
    if (!key || line.category !== "vegetal") continue;
    const known = assigned.get(key);
    const notes = zones.get(key);
    if (!known && !notes) continue;
    const total = Number(String(line.quantity ?? "").replace(",", "."));
    const count = known ? [...known.values()].reduce((s, p) => s + counted(p), 0) : 0;
    const parts: string[] = [
      Number.isFinite(total) && total > 0
        ? `Végétaux au devis — ${count} nommé(s) sur ${total} :`
        : "Végétaux au devis :",
    ];
    if (known) parts.push(...formatList(known));
    if (notes) parts.push(...notes);
    out.set(key, parts.join("\n"));
  }
  return out;
}
