import { supabase } from "@/integrations/supabase/client";

export type StockMovementType = "entree" | "sortie" | "ajustement" | "perte";

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  entree: "Entrée",
  sortie: "Sortie",
  ajustement: "Ajustement",
  perte: "Perte / périmé",
};

export interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  unit_price_ht: number;
  is_perishable: boolean;
  current_quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_price_ht: number | null;
  reason: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
}

export interface StockImportSnapshot {
  id: string;
  item_label: string;
  category: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price_ht: number | null;
  total_ht: number | null;
  is_perishable: boolean | null;
  observations: string | null;
  snapshot_date: string;
  source_sheet: string;
  created_at: string;
}

export async function listStockItems(): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from("pilot_stock_items")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StockItem[];
}

export interface StockMovementWithItem extends StockMovement {
  item: Pick<StockItem, "id" | "name" | "category" | "unit"> | null;
}

export async function listStockMovements(limit = 50): Promise<StockMovementWithItem[]> {
  const { data, error } = await supabase
    .from("pilot_stock_movements")
    .select("*, item:pilot_stock_items(id, name, category, unit)")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as StockMovementWithItem[];
}

export async function listImportSnapshots(): Promise<StockImportSnapshot[]> {
  const { data, error } = await supabase
    .from("pilot_stock_import_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StockImportSnapshot[];
}

/** Valeur du stock au 31/12 de chaque année importée (source_sheet), hors lignes sans total. */
export function importSnapshotsYearlyValue(
  snapshots: StockImportSnapshot[],
): { sourceSheet: string; snapshotDate: string; totalHt: number }[] {
  const bySheet = new Map<string, { snapshotDate: string; totalHt: number }>();
  for (const s of snapshots) {
    const current = bySheet.get(s.source_sheet) ?? { snapshotDate: s.snapshot_date, totalHt: 0 };
    current.totalHt += s.total_ht ?? 0;
    bySheet.set(s.source_sheet, current);
  }
  return [...bySheet.entries()]
    .map(([sourceSheet, v]) => ({ sourceSheet, ...v }))
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
}

export interface StockCategoryTotal {
  category: string;
  value: number;
  itemCount: number;
}

export function stockCategoryBreakdown(items: StockItem[]): StockCategoryTotal[] {
  const byCategory = new Map<string, StockCategoryTotal>();
  for (const it of items) {
    const current = byCategory.get(it.category) ?? {
      category: it.category,
      value: 0,
      itemCount: 0,
    };
    current.value += it.current_quantity * it.unit_price_ht;
    current.itemCount += 1;
    byCategory.set(it.category, current);
  }
  return [...byCategory.values()].sort((a, b) => b.value - a.value);
}

export interface StockMovementInput {
  item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_price_ht?: number | null;
  reason?: string | null;
  occurred_at?: string;
}

export async function createStockMovement(input: StockMovementInput): Promise<StockMovement> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data, error } = await supabase
    .from("pilot_stock_movements")
    .insert({
      item_id: input.item_id,
      movement_type: input.movement_type,
      quantity: input.quantity,
      unit_price_ht: input.unit_price_ht ?? null,
      reason: input.reason ?? null,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      created_by: userId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StockMovement;
}

export interface StockItemUpdateInput {
  name?: string;
  category?: string;
  unit?: string | null;
  unit_price_ht?: number;
  is_perishable?: boolean;
  notes?: string | null;
}

/** Met à jour les attributs d'un article. Ne touche jamais current_quantity :
 * cette colonne est dérivée des mouvements (voir createStockMovement). */
export async function updateStockItem(id: string, input: StockItemUpdateInput): Promise<StockItem> {
  const { data, error } = await supabase
    .from("pilot_stock_items")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as StockItem;
}

export interface StockItemInput {
  name: string;
  category: string;
  unit?: string | null;
  unit_price_ht?: number;
  is_perishable?: boolean;
  notes?: string | null;
}

/** Crée un nouvel article avec un stock initial de 0 (à alimenter par un premier mouvement). */
export async function createStockItem(input: StockItemInput): Promise<StockItem> {
  const { data, error } = await supabase
    .from("pilot_stock_items")
    .insert({
      name: input.name,
      category: input.category,
      unit: input.unit ?? null,
      unit_price_ht: input.unit_price_ht ?? 0,
      is_perishable: input.is_perishable ?? false,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StockItem;
}

export interface StockBulkItemInput extends StockItemInput {
  /** Quantité initiale : si > 0, un mouvement d'entrée est créé après la création de l'article. */
  initialQuantity?: number;
}

export interface StockBulkParseResult {
  rows: StockBulkItemInput[];
  /** Lignes ignorées (vides, mal formées) avec le motif, pour affichage avant validation. */
  errors: string[];
}

const STOCK_BULK_PERISHABLE_TRUE = /^(oui|o|yes|y|true|vrai|1|x)$/i;

/**
 * Parse un texte collé depuis un tableur (Excel/LibreOffice/Google Sheets, séparateur
 * tabulation) ou un CSV français (séparateur point-virgule). Colonnes attendues, dans
 * l'ordre : Nom, Catégorie, Unité, Prix unitaire HT, Quantité initiale, Périssable (oui/non).
 * Seul le nom est obligatoire ; les autres colonnes peuvent être omises en fin de ligne.
 */
export function parseStockBulkPaste(text: string): StockBulkParseResult {
  const rows: StockBulkItemInput[] = [];
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  lines.forEach((line, index) => {
    const separator = line.includes("\t") ? "\t" : ";";
    const cols = line.split(separator).map((c) => c.trim());
    const [name, category, unit, unitPriceRaw, quantityRaw, perishableRaw] = cols;
    const lineNo = index + 1;

    if (!name) {
      errors.push(`Ligne ${lineNo} : nom d'article manquant, ignorée.`);
      return;
    }

    let unitPrice = 0;
    if (unitPriceRaw) {
      unitPrice = Number(unitPriceRaw.replace(",", "."));
      if (Number.isNaN(unitPrice)) {
        errors.push(`Ligne ${lineNo} (${name}) : prix unitaire invalide, ignorée.`);
        return;
      }
    }

    let quantity = 0;
    if (quantityRaw) {
      quantity = Number(quantityRaw.replace(",", "."));
      if (Number.isNaN(quantity)) {
        errors.push(`Ligne ${lineNo} (${name}) : quantité invalide, ignorée.`);
        return;
      }
    }

    rows.push({
      name,
      category: category || "Non catégorisé",
      unit: unit || null,
      unit_price_ht: unitPrice,
      is_perishable: STOCK_BULK_PERISHABLE_TRUE.test((perishableRaw ?? "").trim()),
      initialQuantity: quantity,
    });
  });

  return { rows, errors };
}

export interface StockBulkCreateResult {
  name: string;
  status: "ok" | "error";
  message?: string;
}

/**
 * Crée plusieurs articles à la suite (et leur mouvement d'entrée initial si une quantité
 * est fournie). Séquentiel et tolérant aux erreurs unitaires (ex. doublon de nom) : chaque
 * ligne réussie ou échouée est rapportée individuellement, sans bloquer les suivantes.
 */
export async function createStockItemsBulk(
  inputs: StockBulkItemInput[],
): Promise<StockBulkCreateResult[]> {
  const results: StockBulkCreateResult[] = [];
  for (const input of inputs) {
    try {
      const created = await createStockItem(input);
      if (input.initialQuantity && input.initialQuantity > 0) {
        await createStockMovement({
          item_id: created.id,
          movement_type: "entree",
          quantity: input.initialQuantity,
          unit_price_ht: input.unit_price_ht ?? null,
          reason: "Ajout en masse — stock initial",
        });
      }
      results.push({ name: input.name, status: "ok" });
    } catch (e) {
      results.push({ name: input.name, status: "error", message: (e as Error).message });
    }
  }
  return results;
}
