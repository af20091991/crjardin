// Édition manuelle « façon classeur » des données métier Pilot Pro.
//
// Principe : aucune donnée n'est créée ni recalculée en douce. Chaque cellule
// modifiée passe par updateCell(), qui écrit la nouvelle valeur dans la table
// d'origine ET enregistre la trace (avant / après / date / motif) dans
// pilot_edit_log. Toute modification reste annulable.

import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };

export type CellType = "text" | "number" | "date" | "select";

export interface ColumnDef {
  key: string;
  label: string;
  type: CellType;
  editable?: boolean;
  options?: string[];
  /** Largeur indicative en classes tailwind. */
  width?: string;
}

export interface DatasetDef {
  id: string;
  label: string;
  /** Question métier à laquelle ce classeur répond. */
  question: string;
  table: string;
  columns: ColumnDef[];
  /** Champs concernés par la recherche plein texte. */
  searchFields: string[];
  orderBy: { column: string; ascending: boolean }[];
  /** Impacts analytiques à signaler après modification. */
  impacts: string[];
  labelOf: (row: Record<string, unknown>) => string;
}

const YES_NO = ["true", "false"];

export const DATASETS: DatasetDef[] = [
  {
    id: "ca",
    label: "CA & charges",
    question: "Les montants et catégories de mes lignes financières sont-ils justes ?",
    table: "pilot_ca_entries",
    columns: [
      { key: "year", label: "Année", type: "number" },
      { key: "month", label: "Mois", type: "number" },
      { key: "kind", label: "Nature", type: "select", editable: true, options: ["vente", "charge", "remuneration", "investissement"] },
      { key: "designation", label: "Désignation", type: "text", editable: true, width: "min-w-[16rem]" },
      { key: "amount_ht", label: "Montant HT", type: "number", editable: true },
      { key: "hours", label: "Heures", type: "number", editable: true },
      { key: "charge_class", label: "Classe", type: "select", editable: true, options: ["fixe", "variable", "a_classer"] },
      { key: "charge_category", label: "Catégorie", type: "text", editable: true },
      { key: "is_investment", label: "Investissement", type: "select", editable: true, options: YES_NO },
      { key: "validation_status", label: "Validation", type: "select", editable: true, options: ["a_valider", "valide", "a_revoir"] },
    ],
    searchFields: ["designation", "charge_category"],
    orderBy: [
      { column: "year", ascending: false },
      { column: "month", ascending: false },
    ],
    impacts: ["Direction", "Finance", "Charges", "Rentabilité clients", "Taux horaire"],
    labelOf: (r) => String(r.designation ?? "Ligne financière"),
  },
  {
    id: "clients",
    label: "Clients",
    question: "Mes fiches clients sont-elles complètes et à jour ?",
    table: "clients",
    columns: [
      { key: "name", label: "Nom", type: "text", editable: true, width: "min-w-[14rem]" },
      { key: "civility", label: "Civilité", type: "text", editable: true },
      { key: "address", label: "Adresse", type: "text", editable: true, width: "min-w-[16rem]" },
      { key: "phone", label: "Téléphone", type: "text", editable: true },
      { key: "email", label: "E-mail", type: "text", editable: true },
      { key: "contract_type", label: "Contrat", type: "text", editable: true },
      { key: "frequency", label: "Fréquence", type: "text", editable: true },
      { key: "notes", label: "Notes", type: "text", editable: true, width: "min-w-[16rem]" },
    ],
    searchFields: ["name", "address", "email"],
    orderBy: [{ column: "name", ascending: true }],
    impacts: ["Fiches clients", "Rapprochement CA", "Rentabilité clients"],
    labelOf: (r) => String(r.name ?? "Client"),
  },
  {
    id: "ceev",
    label: "CEEV",
    question: "Mes contrats d'entretien sont-ils correctement valorisés ?",
    table: "ceev_contracts",
    columns: [
      { key: "year", label: "Année", type: "number" },
      { key: "label", label: "Libellé", type: "text", editable: true, width: "min-w-[16rem]" },
      { key: "pv_ht", label: "PV HT", type: "number", editable: true },
      { key: "charges", label: "Charges", type: "number", editable: true },
      { key: "margin_net", label: "Marge nette", type: "number", editable: true },
      { key: "hours", label: "Heures", type: "number", editable: true },
      { key: "status", label: "Statut", type: "text", editable: true },
      { key: "validation_status", label: "Validation", type: "select", editable: true, options: ["a_valider", "valide", "a_revoir"] },
      { key: "notes", label: "Notes", type: "text", editable: true, width: "min-w-[14rem]" },
    ],
    searchFields: ["label", "raw_label"],
    orderBy: [
      { column: "year", ascending: false },
      { column: "label", ascending: true },
    ],
    impacts: ["CEEV", "Rentabilité clients", "Prévisions"],
    labelOf: (r) => String(r.label ?? r.raw_label ?? "Contrat"),
  },
  {
    id: "sst",
    label: "Missions SST",
    question: "Mes missions de sous-traitance sont-elles bien chiffrées ?",
    table: "subcontractor_missions",
    columns: [
      { key: "mission_date", label: "Date", type: "date", editable: true },
      { key: "service_requested", label: "Prestation demandée", type: "text", editable: true, width: "min-w-[16rem]" },
      { key: "category", label: "Catégorie", type: "text", editable: true },
      { key: "agreed_price", label: "Coût SST", type: "number", editable: true },
      { key: "client_price", label: "Prix client", type: "number", editable: true },
      { key: "invoiced_amount", label: "Facturé", type: "number", editable: true },
      { key: "hours_spent", label: "Heures", type: "number", editable: true },
      { key: "hours_saved", label: "Heures dégagées", type: "number", editable: true },
      { key: "status", label: "Statut", type: "text", editable: true },
      { key: "invoice_ref", label: "Réf. facture", type: "text", editable: true },
    ],
    searchFields: ["service_requested", "prestation", "invoice_ref"],
    orderBy: [{ column: "mission_date", ascending: false }],
    impacts: ["Rentabilité SST", "Charges", "Heures dégagées"],
    labelOf: (r) => String(r.service_requested ?? "Mission SST"),
  },
  {
    id: "categories",
    label: "Catégories analytiques",
    question: "Mes catégories de charges sont-elles bien paramétrées ?",
    table: "pilot_charge_categories",
    columns: [
      { key: "label", label: "Libellé", type: "text", editable: true, width: "min-w-[14rem]" },
      { key: "charge_class", label: "Classe", type: "select", editable: true, options: ["fixe", "variable", "a_classer"] },
      { key: "position", label: "Ordre", type: "number", editable: true },
      { key: "is_active", label: "Active", type: "select", editable: true, options: YES_NO },
    ],
    searchFields: ["label"],
    orderBy: [{ column: "position", ascending: true }],
    impacts: ["Charges", "Validation analytique"],
    labelOf: (r) => String(r.label ?? "Catégorie"),
  },
  {
    id: "sst_map",
    label: "Rapprochements SST",
    question: "Quels libellés de dépense correspondent à quel prestataire ?",
    table: "pilot_sst_label_map",
    columns: [
      { key: "raw_label", label: "Libellé d'origine", type: "text", width: "min-w-[18rem]" },
      { key: "provider_name", label: "Prestataire retenu", type: "text", editable: true },
      { key: "note", label: "Note", type: "text", editable: true, width: "min-w-[14rem]" },
    ],
    searchFields: ["raw_label", "provider_name"],
    orderBy: [{ column: "raw_label", ascending: true }],
    impacts: ["Rentabilité SST", "Centre de validation"],
    labelOf: (r) => String(r.raw_label ?? "Libellé"),
  },
];

export function datasetById(id: string): DatasetDef {
  return DATASETS.find((d) => d.id === id) ?? DATASETS[0];
}

export async function fetchRows(def: DatasetDef, limit = 1000): Promise<Record<string, unknown>[]> {
  let q = db.from(def.table).select("*");
  for (const o of def.orderBy) q = q.order(o.column, { ascending: o.ascending, nullsFirst: false });
  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export function parseCell(type: CellType, raw: string): unknown {
  const v = raw.trim();
  if (v === "") return null;
  if (type === "number") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n)) throw new Error("Valeur numérique invalide");
    return n;
  }
  if (type === "select" && (v === "true" || v === "false")) return v === "true";
  return v;
}

export function displayCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export interface EditLogEntry {
  id: string;
  entity: string;
  entity_id: string | null;
  label: string | null;
  field: string;
  before_value: unknown;
  after_value: unknown;
  reason: string | null;
  undone_at: string | null;
  created_at: string;
}

/** Écrit une cellule et journalise systématiquement la modification. */
export async function updateCell(params: {
  def: DatasetDef;
  row: Record<string, unknown>;
  field: string;
  value: unknown;
  reason?: string | null;
}): Promise<void> {
  const { def, row, field, value, reason } = params;
  const id = String(row.id);
  const before = row[field] ?? null;
  if (displayCell(before) === displayCell(value)) return;

  const { error } = await db.from(def.table).update({ [field]: value }).eq("id", id);
  if (error) throw error;

  const { error: logError } = await db.from("pilot_edit_log").insert({
    entity: def.table,
    entity_id: id,
    label: def.labelOf(row),
    field,
    before_value: before,
    after_value: value ?? null,
    reason: reason?.trim() || null,
  });
  if (logError) throw logError;
}

export async function listEditLog(entity?: string, limit = 200): Promise<EditLogEntry[]> {
  let q = db.from("pilot_edit_log").select("*").order("created_at", { ascending: false });
  if (entity) q = q.eq("entity", entity);
  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return (data ?? []) as EditLogEntry[];
}

/** Rétablit la valeur d'avant modification et marque l'entrée comme annulée. */
export async function undoEdit(entry: EditLogEntry): Promise<void> {
  if (!entry.entity_id) throw new Error("Modification non réversible");
  const { error } = await db
    .from(entry.entity)
    .update({ [entry.field]: entry.before_value ?? null })
    .eq("id", entry.entity_id);
  if (error) throw error;
  const { error: e2 } = await db
    .from("pilot_edit_log")
    .update({ undone_at: new Date().toISOString() })
    .eq("id", entry.id);
  if (e2) throw e2;
}