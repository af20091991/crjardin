// Recherche globale Pilot Pro : clients, contrats CEEV, sous-traitants et
// écrans de l'application. Lecture seule sur les tables existantes.

import { supabase } from "@/integrations/supabase/client";

export type SearchKind =
  | "client"
  | "ceev"
  | "sst"
  | "page"
  | "cr"
  | "reco"
  | "materiel"
  | "achat"
  | "mission"
  | "message"
  | "fiche";

export interface SearchResult {
  id: string;
  kind: SearchKind;
  label: string;
  detail?: string;
  to: string;
  params?: Record<string, string>;
  /** Texte complet interrogé par la recherche (absent de l'affichage). */
  haystack?: string;
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  client: "Clients",
  ceev: "Contrats CEEV",
  sst: "Sous-traitants",
  page: "Écrans",
  cr: "Comptes-rendus",
  reco: "Préconisations",
  materiel: "Matériel",
  achat: "Achats et fournisseurs",
  mission: "Missions SST",
  message: "Messages clients",
  fiche: "Fiches chantier",
};

export const SEARCH_PAGES: SearchResult[] = [
  { id: "p-today", kind: "page", label: "Aujourd'hui", to: "/pilot" },
  { id: "p-direction", kind: "page", label: "Direction", to: "/pilot/direction" },
  { id: "p-ca", kind: "page", label: "Suivi du CA", to: "/pilot/ca" },
  { id: "p-charges", kind: "page", label: "Charges", to: "/pilot/charges" },
  { id: "p-finance", kind: "page", label: "Finance", to: "/pilot/finance" },
  { id: "p-rentab", kind: "page", label: "Rentabilité clients", to: "/pilot/clients" },
  { id: "p-prest", kind: "page", label: "Rentabilité prestations", to: "/pilot/temps" },
  { id: "p-compar", kind: "page", label: "Comparatifs et prévisions", to: "/pilot/benchmark" },
  { id: "p-ceev", kind: "page", label: "Contrats CEEV", to: "/pilot/ceev" },
  { id: "p-taux", kind: "page", label: "Analyse temps & rentabilité", to: "/pilot/temps" },
  { id: "p-sante", kind: "page", label: "Santé", to: "/pilot/sante" },
  {
    id: "p-site-web",
    kind: "page",
    label: "Site web",
    detail: "Visibilité · SEO · Contenus",
    to: "/pilot/site-web",
  },
  {
    id: "p-controle",
    kind: "page",
    label: "Centre de contrôle des données",
    to: "/pilot/controle",
  },
  {
    id: "p-controle-referentiel",
    kind: "page",
    label: "Certification du référentiel client économique",
    to: "/pilot/controle",
  },
  {
    id: "p-controle-sources",
    kind: "page",
    label: "Sources officielles des données",
    to: "/pilot/controle",
  },
  { id: "p-valid", kind: "page", label: "Centre de validation manuelle", to: "/pilot/validation" },
  { id: "p-sst", kind: "page", label: "Sous-traitants", to: "/sst" },
  { id: "p-journal", kind: "page", label: "Journal SST", to: "/sst" },
];

/** Charge une fois l'index de recherche (données réelles uniquement). */
export async function loadSearchIndex(): Promise<SearchResult[]> {
  const [clients, ceev, sst] = await Promise.all([
    supabase.from("clients").select("id,name,address,email,phone,notes").order("name").limit(1000),
    supabase
      .from("ceev_contracts")
      .select("id,label,year")
      .order("year", { ascending: false })
      .limit(500),
    supabase.from("subcontractors").select("id,name,company").order("name").limit(200),
  ]);

  const out: SearchResult[] = [...SEARCH_PAGES];

  const clientNames = new Map<string, string>();
  for (const c of (clients.data ?? []) as Array<{
    id: string;
    name: string;
    address: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  }>) {
    clientNames.set(c.id, c.name);
    out.push({
      id: `client-${c.id}`,
      kind: "client",
      label: c.name,
      detail: c.address ?? undefined,
      to: "/clients/$clientId",
      params: { clientId: c.id },
      haystack: [c.name, c.address, c.email, c.phone, c.notes].filter(Boolean).join(" "),
    });
  }
  out.push(...(await loadDataIndex(clientNames)));
  for (const c of (ceev.data ?? []) as Array<{ id: string; label: string; year: number }>) {
    out.push({
      id: `ceev-${c.id}`,
      kind: "ceev",
      label: c.label,
      detail: `Contrat ${c.year}`,
      to: "/pilot/ceev",
    });
  }
  for (const s of (sst.data ?? []) as Array<{ id: string; name: string; company: string | null }>) {
    out.push({
      id: `sst-${s.id}`,
      kind: "sst",
      label: s.name,
      detail: s.company ?? undefined,
      to: "/sst",
    });
  }
  return out;
}

type Row = Record<string, string | null>;

/** Toutes les autres informations de l'application (CR, préconisations, matériel, achats, missions…). */
async function loadDataIndex(clientNames: Map<string, string>): Promise<SearchResult[]> {
  const [ivs, recos, equip, sup, supplies, missions, messages, sheets, agreements] =
    await Promise.all([
      supabase
        .from("interventions")
        .select(
          "id,client_id,intervention_date,intervention_type,recommendations_text,attention_points,positive_points",
        )
        .order("intervention_date", { ascending: false })
        .limit(2000),
      supabase
        .from("recommendations")
        .select("id,title,description,client_id,intervention_id")
        .limit(2000),
      supabase.from("equipment").select("id,name,category,notes").limit(500),
      supabase.from("ap_suppliers").select("id,name,email,phone,comment").limit(300),
      supabase.from("ap_supplies").select("id,item,supplier,comment,status").limit(2000),
      supabase
        .from("subcontractor_missions")
        .select("id,prestation,context_notes,objective,invoice_ref,client_id,mission_date")
        .limit(2000),
      supabase.from("client_messages").select("id,content,client_id,created_at").limit(2000),
      supabase
        .from("worksite_sheets")
        .select("id,client_name,address,notes,intervention_date")
        .limit(1000),
      supabase.from("ceev_agreements").select("id,name,site_address,notes").limit(300),
    ]);

  const out: SearchResult[] = [];
  const name = (id: string | null | undefined) => (id ? clientNames.get(id) : undefined);
  const join = (...parts: Array<string | null | undefined>) =>
    parts.filter((p): p is string => !!p && p.trim() !== "").join(" ");

  for (const r of (ivs.data ?? []) as Row[]) {
    out.push({
      id: `cr-${r.id}`,
      kind: "cr",
      label: `${name(r.client_id) ?? "Chantier"} · CR ${r.intervention_date ?? ""}`.trim(),
      detail: r.intervention_type ?? undefined,
      to: "/interventions/$interventionId",
      params: { interventionId: r.id! },
      haystack: join(
        name(r.client_id),
        r.intervention_type,
        r.recommendations_text,
        r.attention_points,
        r.positive_points,
      ),
    });
  }
  for (const r of (recos.data ?? []) as Row[]) {
    const to = r.intervention_id ? "/interventions/$interventionId" : "/clients/$clientId";
    const params: Record<string, string> = r.intervention_id
      ? { interventionId: r.intervention_id }
      : { clientId: r.client_id ?? "" };
    out.push({
      id: `reco-${r.id}`,
      kind: "reco",
      label: r.title ?? "Préconisation",
      detail: name(r.client_id),
      to,
      params,
      haystack: join(r.title, r.description, name(r.client_id)),
    });
  }
  for (const r of (equip.data ?? []) as Row[]) {
    out.push({
      id: `mat-${r.id}`,
      kind: "materiel",
      label: r.name ?? "Matériel",
      detail: r.category ?? undefined,
      to: "/parc-materiel/$equipmentId",
      params: { equipmentId: r.id! },
      haystack: join(r.name, r.category, r.notes),
    });
  }
  for (const r of (sup.data ?? []) as Row[]) {
    out.push({
      id: `fou-${r.id}`,
      kind: "achat",
      label: r.name ?? "Fournisseur",
      detail: r.email ?? r.phone ?? undefined,
      to: "/pilot/assistant-ap",
      haystack: join(r.name, r.email, r.phone, r.comment),
    });
  }
  for (const r of (supplies.data ?? []) as Row[]) {
    out.push({
      id: `app-${r.id}`,
      kind: "achat",
      label: r.item ?? "Fourniture",
      detail: r.supplier ?? undefined,
      to: "/pilot/assistant-ap",
      haystack: join(r.item, r.supplier, r.comment),
    });
  }
  for (const r of (missions.data ?? []) as Row[]) {
    out.push({
      id: `mis-${r.id}`,
      kind: "mission",
      label: r.prestation ?? "Mission",
      detail: join(name(r.client_id), r.mission_date),
      to: "/sst",
      haystack: join(r.prestation, r.context_notes, r.objective, r.invoice_ref, name(r.client_id)),
    });
  }
  for (const r of (messages.data ?? []) as Row[]) {
    out.push({
      id: `msg-${r.id}`,
      kind: "message",
      label: (r.content ?? "").slice(0, 80) || "Message",
      detail: name(r.client_id),
      to: "/clients/$clientId",
      params: { clientId: r.client_id ?? "" },
      haystack: join(r.content, name(r.client_id)),
    });
  }
  for (const r of (sheets.data ?? []) as Row[]) {
    out.push({
      id: `fic-${r.id}`,
      kind: "fiche",
      label: r.client_name ?? "Fiche chantier",
      detail: r.address ?? undefined,
      to: "/fiches",
      haystack: join(r.client_name, r.address, r.notes),
    });
  }
  for (const r of (agreements.data ?? []) as Row[]) {
    out.push({
      id: `agr-${r.id}`,
      kind: "ceev",
      label: r.name ?? "Contrat",
      detail: r.site_address ?? undefined,
      to: "/pilot/ceev-contrats/$agreementId",
      params: { agreementId: r.id! },
      haystack: join(r.name, r.site_address, r.notes),
    });
  }
  return out;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function searchIndex(index: SearchResult[], query: string, limit = 40): SearchResult[] {
  const q = normalize(query.trim());
  if (!q) return index.filter((r) => r.kind === "page").slice(0, limit);
  return index
    .filter((r) => normalize(r.haystack ?? `${r.label} ${r.detail ?? ""}`).includes(q))
    .slice(0, limit);
}
