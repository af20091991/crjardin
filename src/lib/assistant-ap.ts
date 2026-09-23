import { supabase } from "@/integrations/supabase/client";

// Assistant AP — pilotage des approvisionnements des chantiers d'aménagement.
// Source des données : tables ap_worksites / ap_supplies.

export const AP_STATUSES = [
  "a_faire",
  "commande_reserve",
  "retrait_livraison_prevu",
  "ok",
  "a_relancer",
] as const;
export type ApStatus = (typeof AP_STATUSES)[number];

export const AP_STATUS_LABELS: Record<ApStatus, string> = {
  a_faire: "À faire",
  commande_reserve: "Commandé / réservé",
  retrait_livraison_prevu: "Retrait / livraison prévu",
  ok: "OK",
  a_relancer: "À relancer",
};

export const AP_MODES = ["retrait", "livraison", "stock"] as const;
export type ApMode = (typeof AP_MODES)[number];

export const AP_MODE_LABELS: Record<ApMode, string> = {
  retrait: "Retrait",
  livraison: "Livraison",
  stock: "Stock",
};

export interface ApSupply {
  id: string;
  worksite_id: string;
  supplier: string;
  supplier_id: string | null;
  quantity: string | null;
  item: string;
  status: ApStatus;
  mode: ApMode;
  fulfillment_date: string | null;
  comment: string | null;
}

export interface ApSupplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  comment: string | null;
}


export interface ApWorksite {
  id: string;
  client_label: string;
  scheduled_date: string | null;
  date_label: string | null;
  notes: string | null;
  supplies: ApSupply[];
}

/** État global d'un chantier — calculé, jamais saisi. */
export type ApGlobalState = "a_verifier" | "a_relancer" | "a_faire" | "en_cours" | "ok";

export const AP_GLOBAL_STATE_LABELS: Record<ApGlobalState, string> = {
  a_verifier: "À vérifier",
  a_relancer: "À relancer",
  a_faire: "À faire",
  en_cours: "En cours",
  ok: "OK",
};

export function worksiteGlobalState(supplies: Pick<ApSupply, "status">[]): ApGlobalState {
  if (supplies.length === 0) return "a_verifier";
  if (supplies.some((s) => s.status === "a_relancer")) return "a_relancer";
  if (supplies.some((s) => s.status === "a_faire")) return "a_faire";
  if (supplies.every((s) => s.status === "ok")) return "ok";
  return "en_cours";
}

/** Nombre d'éléments à traiter (tout ce qui n'est pas OK) et à relancer. */
export function worksiteCounts(supplies: Pick<ApSupply, "status">[]): {
  toHandle: number;
  toFollowUp: number;
} {
  return {
    toHandle: supplies.filter((s) => s.status !== "ok").length,
    toFollowUp: supplies.filter((s) => s.status === "a_relancer").length,
  };
}

/** Retraits/livraisons datés à venir dans la fenêtre donnée (bornes incluses). */
export function upcomingFulfillments(
  worksites: ApWorksite[],
  today: string,
  days = 21,
): { worksite: ApWorksite; supply: ApSupply }[] {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const endIso = end.toISOString().slice(0, 10);
  const out: { worksite: ApWorksite; supply: ApSupply }[] = [];
  for (const w of worksites) {
    for (const s of w.supplies) {
      if (s.mode === "stock") continue;
      if (!s.fulfillment_date) continue;
      if (s.fulfillment_date >= today && s.fulfillment_date <= endIso)
        out.push({ worksite: w, supply: s });
    }
  }
  return out.sort((a, b) => (a.supply.fulfillment_date! < b.supply.fulfillment_date! ? -1 : 1));
}

export function sortWorksites(worksites: ApWorksite[]): ApWorksite[] {
  return [...worksites].sort((a, b) => {
    if (a.scheduled_date && b.scheduled_date) {
      if (a.scheduled_date === b.scheduled_date)
        return a.client_label.localeCompare(b.client_label);
      return a.scheduled_date < b.scheduled_date ? -1 : 1;
    }
    if (a.scheduled_date) return -1;
    if (b.scheduled_date) return 1;
    return a.client_label.localeCompare(b.client_label);
  });
}

// ───────────────────────── Accès aux données ─────────────────────────

const SELECT =
  "id, client_label, scheduled_date, date_label, notes, ap_supplies(id, worksite_id, supplier, item, status, mode, fulfillment_date, comment)";

export async function listApWorksites(): Promise<ApWorksite[]> {
  const { data, error } = await supabase.from("ap_worksites").select(SELECT);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<ApWorksite, "supplies"> & {
    ap_supplies: ApSupply[];
  })[];
  return sortWorksites(
    rows.map((r) => ({
      id: r.id,
      client_label: r.client_label,
      scheduled_date: r.scheduled_date,
      date_label: r.date_label,
      notes: r.notes,
      supplies: [...(r.ap_supplies ?? [])].sort((a, b) =>
        `${a.supplier}${a.item}`.localeCompare(`${b.supplier}${b.item}`),
      ),
    })),
  );
}

export async function createApWorksite(input: {
  client_label: string;
  scheduled_date: string | null;
  date_label?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("ap_worksites").insert({
    client_label: input.client_label,
    scheduled_date: input.scheduled_date,
    date_label: input.date_label ?? null,
    notes: input.notes ?? null,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateApWorksite(
  id: string,
  patch: Partial<Pick<ApWorksite, "client_label" | "scheduled_date" | "date_label" | "notes">>,
): Promise<void> {
  const { error } = await supabase.from("ap_worksites").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteApWorksite(id: string): Promise<void> {
  const { error } = await supabase.from("ap_worksites").delete().eq("id", id);
  if (error) throw error;
}

export async function createApSupply(input: {
  worksite_id: string;
  supplier: string;
  item: string;
  status: ApStatus;
  mode: ApMode;
  fulfillment_date: string | null;
  comment: string | null;
}): Promise<void> {
  const { error } = await supabase.from("ap_supplies").insert(input);
  if (error) throw error;
}

export async function updateApSupply(
  id: string,
  patch: Partial<
    Pick<ApSupply, "supplier" | "item" | "status" | "mode" | "fulfillment_date" | "comment">
  >,
): Promise<void> {
  const { error } = await supabase.from("ap_supplies").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteApSupply(id: string): Promise<void> {
  const { error } = await supabase.from("ap_supplies").delete().eq("id", id);
  if (error) throw error;
}
