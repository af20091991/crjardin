// Recherche globale Pilot Pro : clients, contrats CEEV, sous-traitants et
// écrans de l'application. Lecture seule sur les tables existantes.

import { supabase } from "@/integrations/supabase/client";

export type SearchKind = "client" | "ceev" | "sst" | "page";

export interface SearchResult {
  id: string;
  kind: SearchKind;
  label: string;
  detail?: string;
  to: string;
  params?: Record<string, string>;
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  client: "Clients",
  ceev: "Contrats CEEV",
  sst: "Sous-traitants",
  page: "Écrans",
};

export const SEARCH_PAGES: SearchResult[] = [
  { id: "p-today", kind: "page", label: "Aujourd'hui", to: "/pilot" },
  { id: "p-direction", kind: "page", label: "Direction", to: "/pilot/direction" },
  { id: "p-ca", kind: "page", label: "Suivi du CA", to: "/pilot/ca" },
  { id: "p-charges", kind: "page", label: "Charges", to: "/pilot/charges" },
  { id: "p-finance", kind: "page", label: "Finance", to: "/pilot/finance" },
  { id: "p-rentab", kind: "page", label: "Rentabilité clients", to: "/pilot/clients" },
  { id: "p-prest", kind: "page", label: "Prestations", to: "/pilot/prestations" },
  { id: "p-temps-renta", kind: "page", label: "Analyse Temps & Rentabilité", to: "/pilot/temps" },
  { id: "p-ceev", kind: "page", label: "Contrats CEEV", to: "/pilot/ceev" },
  { id: "p-taux", kind: "page", label: "Taux horaire", to: "/pilot/taux" },
  { id: "p-sante", kind: "page", label: "Santé", to: "/pilot/sante" },
  { id: "p-controle", kind: "page", label: "Centre de contrôle des données", to: "/pilot/controle" },
  {
    id: "p-controle-referentiel",
    kind: "page",
    label: "Certification du référentiel client économique",
    to: "/pilot/controle",
  },
  {
    id: "p-controle-sources",
    kind: "page",
    label: "Sources officielles des données & états de rapprochement",
    to: "/pilot/controle",
  },
  { id: "p-valid", kind: "page", label: "Centre de validation manuelle", to: "/pilot/validation" },
  { id: "p-sst", kind: "page", label: "Sous-traitants", to: "/sst" },
  { id: "p-journal", kind: "page", label: "Journal SST", to: "/journal-sst" },
  { id: "p-planning", kind: "page", label: "Planning", to: "/planning" },
];

/** Charge une fois l'index de recherche (données réelles uniquement). */
export async function loadSearchIndex(): Promise<SearchResult[]> {
  const [clients, ceev, sst] = await Promise.all([
    supabase.from("clients").select("id,name,address").order("name").limit(1000),
    supabase.from("ceev_contracts").select("id,label,year").order("year", { ascending: false }).limit(500),
    supabase.from("subcontractors").select("id,name,company").order("name").limit(200),
  ]);

  const out: SearchResult[] = [...SEARCH_PAGES];

  for (const c of (clients.data ?? []) as Array<{ id: string; name: string; address: string | null }>) {
    out.push({
      id: `client-${c.id}`,
      kind: "client",
      label: c.name,
      detail: c.address ?? undefined,
      to: "/pilot/fiche/$clientId",
      params: { clientId: c.id },
    });
  }
  for (const c of (ceev.data ?? []) as Array<{ id: string; label: string; year: number }>) {
    out.push({ id: `ceev-${c.id}`, kind: "ceev", label: c.label, detail: `Contrat ${c.year}`, to: "/pilot/ceev" });
  }
  for (const s of (sst.data ?? []) as Array<{ id: string; name: string; company: string | null }>) {
    out.push({ id: `sst-${s.id}`, kind: "sst", label: s.name, detail: s.company ?? undefined, to: "/sst" });
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
    .filter((r) => normalize(`${r.label} ${r.detail ?? ""}`).includes(q))
    .slice(0, limit);
}