// Rapprochement contrôlé du Temps des ventes CA avec le fichier Excel source.
//
// RÈGLE : le fichier Excel est la source de vérité du Temps. Ce module ne
// fabrique JAMAIS de donnée :
//  - une cellule vide, un tiret ou un texte illisible reste INCONNU ;
//  - seul un 0 numérique explicite (`0`, `0,0`, `0.0`) vaut zéro ;
//  - une correspondance doit être UNIQUE et démontrable pour être appliquée ;
//  - toute écriture est journalisée (avant/après, clé, source, confiance) et
//    annulable via le mécanisme existant (pilot_edit_log / undoEdit).

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

// ── Normalisations (comparaison uniquement, jamais d'écriture) ──────────────

export function normalizeLabel(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string") return null;
  const cleaned = v
    .replace(/\u00a0|\s/g, "")
    .replace(/[€]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export type ExcelTime =
  /** 0 numérique explicite : temps connu et valide. */
  | { kind: "zero" }
  /** Temps strictement positif. */
  | { kind: "positive"; hours: number }
  /** Valeur numérique refusée (négative, infinie). */
  | { kind: "invalide"; raw: string }
  /** Cellule vide, tiret, texte non numérique : donnée inconnue. */
  | { kind: "inconnu"; raw: string };

/** Lecture STRICTE d'une cellule Temps Excel. Aucune valeur inventée. */
export function parseExcelHours(raw: unknown): ExcelTime {
  if (raw == null) return { kind: "inconnu", raw: "" };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { kind: "invalide", raw: String(raw) };
    return raw === 0 ? { kind: "zero" } : { kind: "positive", hours: raw };
  }
  const s = String(raw).trim();
  if (s === "") return { kind: "inconnu", raw: s };
  const cleaned = s
    .replace(/\u00a0|\s/g, "")
    .replace(/h$/i, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { kind: "inconnu", raw: s };
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return { kind: "invalide", raw: s };
  return n === 0 ? { kind: "zero" } : { kind: "positive", hours: n };
}

// ── Lignes comparées ────────────────────────────────────────────────────────

export interface ExcelSaleRow {
  rowIndex: number;
  year: number | null;
  month: number | null;
  client: string | null;
  designation: string | null;
  amountHt: number | null;
  interventionType: string | null;
  time: ExcelTime;
}

export interface CaSaleRow {
  id: string;
  year: number;
  month: number;
  clientName: string | null;
  designation: string | null;
  amountHt: number;
  interventionType: string | null;
  hours: number | null;
}

/** Clé déterministe : année/mois + client + désignation + montant HT. */
export function matchKey(r: {
  year: number | null;
  month: number | null;
  client?: string | null;
  designation?: string | null;
  amountHt: number | null;
}): string {
  return [
    r.year ?? "?",
    String(r.month ?? "?").padStart(2, "0"),
    normalizeLabel(r.client) || "-",
    normalizeLabel(r.designation) || "-",
    r.amountHt == null ? "?" : r.amountHt.toFixed(2),
  ].join("|");
}

export type TimeVerdict =
  | "temps_positif"
  | "zero_confirme"
  | "absent_excel"
  | "ambigu"
  | "valeur_invalide"
  | "excel_introuvable";

export const TIME_VERDICT_LABEL: Record<TimeVerdict, string> = {
  temps_positif: "Temps positif confirmé par Excel",
  zero_confirme: "Temps = 0 confirmé par Excel",
  absent_excel: "Temps absent dans Excel",
  ambigu: "Correspondance ambiguë — confirmation requise",
  valeur_invalide: "Valeur Excel invalide",
  excel_introuvable: "Excel introuvable",
};

export interface TimeProof {
  saleId: string;
  label: string;
  year: number;
  month: number;
  amountHt: number;
  key: string;
  currentHours: number | null;
  sourceHours: number | null;
  excelRowIndex: number | null;
  candidates: number;
  verdict: TimeVerdict;
  confidence: "certaine" | "probable" | "insuffisante";
  restorable: boolean;
  message: string;
}

function typeMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return true;
  return na === nb;
}

/** Candidats Excel d'une vente : période + montant + (client OU désignation). */
export function excelCandidates(sale: CaSaleRow, excel: ExcelSaleRow[]): ExcelSaleRow[] {
  const amount = Math.round(sale.amountHt * 100) / 100;
  const client = normalizeLabel(sale.clientName);
  const designation = normalizeLabel(sale.designation);
  if (!client && !designation) return [];
  return excel.filter((e) => {
    if (e.year !== sale.year || e.month !== sale.month) return false;
    if (e.amountHt == null || Math.abs(e.amountHt - amount) > 0.01) return false;
    const ec = normalizeLabel(e.client);
    const ed = normalizeLabel(e.designation);
    const identityOk = (!!client && client === ec) || (!!designation && designation === ed);
    if (!identityOk) return false;
    return typeMatches(sale.interventionType, e.interventionType);
  });
}

export function buildTimeProof(
  sale: CaSaleRow,
  excel: ExcelSaleRow[],
  excelAvailable: boolean,
): TimeProof {
  const base = {
    saleId: sale.id,
    label: `${sale.clientName ?? "Client non rattaché"} — ${sale.designation ?? "Ligne de vente"}`,
    year: sale.year,
    month: sale.month,
    amountHt: sale.amountHt,
    key: matchKey({
      year: sale.year,
      month: sale.month,
      client: sale.clientName,
      designation: sale.designation,
      amountHt: Math.round(sale.amountHt * 100) / 100,
    }),
    currentHours: sale.hours == null ? null : Number(sale.hours),
    sourceHours: null as number | null,
    excelRowIndex: null as number | null,
    candidates: 0,
    restorable: false,
  };
  if (!excelAvailable) {
    return {
      ...base,
      verdict: "excel_introuvable",
      confidence: "insuffisante",
      message: "Fichier Excel source non chargé : le temps reste inconnu.",
    };
  }
  const cands = excelCandidates(sale, excel);
  if (cands.length === 0) {
    return {
      ...base,
      verdict: "absent_excel",
      confidence: "insuffisante",
      message: "Aucune ligne Excel ne correspond à cette clé : le temps reste inconnu.",
    };
  }
  if (cands.length > 1) {
    return {
      ...base,
      candidates: cands.length,
      verdict: "ambigu",
      confidence: "probable",
      message: `${cands.length} lignes Excel correspondent : aucune écriture, confirmation humaine requise.`,
    };
  }
  const only = cands[0];
  const shared = { ...base, candidates: 1, excelRowIndex: only.rowIndex };
  if (only.time.kind === "zero") {
    return {
      ...shared,
      sourceHours: 0,
      verdict: "zero_confirme",
      confidence: "certaine",
      restorable: true,
      message: "0 h — aucune intervention présentielle sur cette ligne, valeur saisie valide.",
    };
  }
  if (only.time.kind === "positive") {
    return {
      ...shared,
      sourceHours: only.time.hours,
      verdict: "temps_positif",
      confidence: "certaine",
      restorable: true,
      message: `Temps ${only.time.hours} h lu dans Excel (ligne ${only.rowIndex}).`,
    };
  }
  if (only.time.kind === "invalide") {
    return {
      ...shared,
      verdict: "valeur_invalide",
      confidence: "insuffisante",
      message: `Valeur Excel refusée (« ${only.time.raw} ») : jamais convertie en 0.`,
    };
  }
  return {
    ...shared,
    verdict: "absent_excel",
    confidence: "insuffisante",
    message: "Cellule Temps vide ou illisible dans Excel : le temps reste inconnu.",
  };
}

export interface TimeReconciliation {
  proofs: TimeProof[];
  counts: Record<TimeVerdict, number>;
  restorableZero: number;
  restorablePositive: number;
}

export function reconcileSaleTimes(params: {
  sales: CaSaleRow[];
  excel: ExcelSaleRow[];
  excelAvailable?: boolean;
}): TimeReconciliation {
  const available = params.excelAvailable ?? params.excel.length > 0;
  const counts: Record<TimeVerdict, number> = {
    temps_positif: 0,
    zero_confirme: 0,
    absent_excel: 0,
    ambigu: 0,
    valeur_invalide: 0,
    excel_introuvable: 0,
  };
  const proofs = params.sales.map((s) => buildTimeProof(s, params.excel, available));
  for (const p of proofs) counts[p.verdict] += 1;
  return {
    proofs,
    counts,
    restorableZero: proofs.filter((p) => p.restorable && p.sourceHours === 0).length,
    restorablePositive: proofs.filter((p) => p.restorable && (p.sourceHours ?? 0) > 0).length,
  };
}

/** Motif journalisé — porte la preuve complète du rapprochement. */
export function restorationReason(p: TimeProof): string {
  return [
    "Restauration du Temps depuis le fichier Excel source",
    `clé ${p.key}`,
    `ligne Excel ${p.excelRowIndex}`,
    `avant ${p.currentHours == null ? "non renseigné" : `${p.currentHours} h`}`,
    `après ${p.sourceHours} h`,
    `confiance ${p.confidence}`,
  ].join(" — ");
}

/** Écriture unitaire : uniquement une correspondance unique et démontrable. */
export async function restoreSaleTime(p: TimeProof): Promise<void> {
  if (!p.restorable || p.sourceHours == null) {
    throw new Error("Correspondance non démontrable : aucune écriture effectuée.");
  }
  const { error } = await db
    .from("pilot_ca_entries")
    .update({ hours: p.sourceHours })
    .eq("id", p.saleId);
  if (error) throw error;
  const { error: logError } = await db.from("pilot_edit_log").insert({
    entity: "pilot_ca_entries",
    entity_id: p.saleId,
    label: p.label,
    field: "hours",
    before_value: p.currentHours,
    after_value: p.sourceHours,
    reason: restorationReason(p),
  });
  if (logError) throw logError;
}

export async function restoreSaleTimes(proofs: TimeProof[]): Promise<number> {
  let done = 0;
  for (const p of proofs) {
    if (!p.restorable) continue;
    await restoreSaleTime(p);
    done += 1;
  }
  return done;
}

// ── Lecture du classeur (navigateur) ───────────────────────────────────────

const HEADER_ALIASES: Record<string, string[]> = {
  year: ["annee", "an", "exercice"],
  month: ["mois"],
  date: ["date"],
  client: ["client", "nom client", "client nom"],
  designation: ["designation", "prestation", "libelle", "intitule"],
  amountHt: ["montant ht", "ht", "montant", "ca ht"],
  interventionType: ["type", "type de prestation", "type intervention"],
  time: ["temps", "heures", "temps h", "nb heures"],
};

function headerMap(row: unknown[]): Record<string, number> {
  const out: Record<string, number> = {};
  row.forEach((cell, i) => {
    const n = normalizeLabel(String(cell ?? ""));
    if (!n) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (out[field] != null) continue;
      if (aliases.includes(n)) out[field] = i;
    }
  });
  return out;
}

/** Construit les lignes Excel à partir d'une matrice de cellules brutes. */
export function excelRowsFromMatrix(matrix: unknown[][]): ExcelSaleRow[] {
  let head = -1;
  let map: Record<string, number> = {};
  for (let i = 0; i < Math.min(matrix.length, 30); i += 1) {
    const m = headerMap(matrix[i] ?? []);
    if (m.time != null && (m.designation != null || m.client != null)) {
      head = i;
      map = m;
      break;
    }
  }
  if (head < 0) return [];
  const out: ExcelSaleRow[] = [];
  for (let i = head + 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const at = (k: string) => (map[k] == null ? null : (row[map[k]] ?? null));
    let year = map.year == null ? null : normalizeAmount(at("year"));
    let month = map.month == null ? null : normalizeAmount(at("month"));
    const dateCell = at("date");
    if ((year == null || month == null) && dateCell) {
      const d = new Date(String(dateCell));
      if (!Number.isNaN(d.getTime())) {
        year = year ?? d.getFullYear();
        month = month ?? d.getMonth() + 1;
      }
    }
    const client = map.client == null ? null : String(at("client") ?? "").trim() || null;
    const designation =
      map.designation == null ? null : String(at("designation") ?? "").trim() || null;
    if (!client && !designation) continue;
    out.push({
      rowIndex: i + 1,
      year: year == null ? null : Math.round(year),
      month: month == null ? null : Math.round(month),
      client,
      designation,
      amountHt: normalizeAmount(at("amountHt")),
      interventionType:
        map.interventionType == null ? null : String(at("interventionType") ?? "").trim() || null,
      time: parseExcelHours(at("time")),
    });
  }
  return out;
}

/** Lecture d'un classeur .xlsx/.csv choisi par l'utilisateur. */
export async function readExcelTimeFile(file: File): Promise<ExcelSaleRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const rows: ExcelSaleRow[] = [];
  for (const name of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
    });
    rows.push(...excelRowsFromMatrix(matrix as unknown[][]));
  }
  return rows;
}

/** Ventes de l'exercice dont le temps est absent (0 h explicite exclu). */
export async function listSalesWithUnknownTime(year: number): Promise<CaSaleRow[]> {
  const [ca, clients] = await Promise.all([
    db
      .from("pilot_ca_entries")
      .select("id,year,month,designation,client_id,amount_ht,hours,intervention_type")
      .eq("kind", "vente")
      .eq("year", year)
      .limit(5000),
    db.from("clients").select("id,name"),
  ]);
  if (ca.error) throw ca.error;
  if (clients.error) throw clients.error;
  const names = new Map(
    ((clients.data ?? []) as Record<string, unknown>[]).map((c) => [String(c.id), String(c.name)]),
  );
  return ((ca.data ?? []) as Record<string, unknown>[])
    .filter((r) => r.hours == null || !Number.isFinite(Number(r.hours)) || Number(r.hours) < 0)
    .map((r) => ({
      id: String(r.id),
      year: Number(r.year),
      month: Number(r.month),
      clientName: r.client_id ? (names.get(String(r.client_id)) ?? null) : null,
      designation: r.designation == null ? null : String(r.designation),
      amountHt: Number(r.amount_ht) || 0,
      interventionType: r.intervention_type == null ? null : String(r.intervention_type),
      hours: r.hours == null ? null : Number(r.hours),
    }));
}
