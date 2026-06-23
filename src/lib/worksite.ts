import { supabase } from "@/integrations/supabase/client";

/** Listes de référence reprises de l'outil « Fiche chantier » SST. */
export const INTERVENANTS = ["Chloé", "Fanny", "Angélique", "Lionel"] as const;

export const EQUIPMENT_GROUPS: { group: string; items: string[] }[] = [
  { group: "Taille-haie", items: ["Taille-haie déflecteur (R)", "Taille-haie double peigne (T)", "Taille-haie perche télescopique", "Taille-haie perche de rabattage"] },
  { group: "Motorisé", items: ["Souffleur", "Tondeuse", "Débroussailleuse", "Broyeur", "Désherbeur thermique", "Tronçonneuse", "Tronçonneuse perche"] },
  { group: "Outils à main", items: ["Râteau feuille", "Râteau métal", "Pioche", "Bêche", "Fourche", "Balai brosse", "Pelle minérale", "Pelle terre", "Échenilloir", "Sécateur à main", "Sécateur de force", "Cisaille"] },
  { group: "Accessoires", items: ["Escabeau", "Poubelle", "Sacs à déchets", "Rampes"] },
  { group: "Batterie", items: ["AP200S", "AP300", "AP500S", "AR3000", "AS1", "Batterie portable", "Chargeur AL301", "Chargeur AS1"] },
];

export const EPI_OPTIONS = [
  "Chaussures de sécurité",
  "Gants",
  "Lunettes",
  "Casque anti-bruit",
  "Gants anti-coupure",
  "Pantalon anti-coupure",
  "Visière",
  "Gilet haute visibilité",
  "Masque à poussière",
  "Casque",
] as const;

export const TASK_GROUPS: { group: string; items: string[] }[] = [
  { group: "Taille de haie", items: ["Taille de haie sur 1 face", "Taille de haie sur 2 faces", "Taille de haie sur 3 faces", "Taille de haie de rabattage"] },
  { group: "Élagage & arbres", items: ["Taille d'arbustes", "Taille de rosiers", "Taille de fruitiers", "Élagage", "Abattage", "Broyage des branches"] },
  { group: "Entretien de pelouse", items: ["Tonte", "Tonte mulching", "Scarification", "Aération du gazon", "Engazonnement / semis", "Réfection de pelouse"] },
  { group: "Entretien de massif", items: ["Désherbage manuel", "Désherbage thermique", "Binage", "Sarclage", "Paillage", "Apport d'engrais / amendement", "Nettoyage des massifs", "Plantation", "Bêchage / préparation du sol"] },
  { group: "Débroussaillage", items: ["Débroussaillage léger", "Débroussaillage dense", "Débroussaillage réglementaire (OLD)"] },
  { group: "Nettoyage & finitions", items: ["Ramassage de feuilles", "Soufflage des allées", "Nettoyage des terrasses / allées", "Désherbage des joints", "Arrosage"] },
  { group: "Évacuation", items: ["Évacuation des déchets verts", "Dépôt en déchèterie"] },
];

export const CHECKLIST_OPTIONS = [
  "Site nettoyé / déchets ramassés",
  "Matériel rangé dans le véhicule",
  "Vérification clés / portail refermé",
  "Photos avant/après réalisées",
  "Client informé de la fin de l'intervention (si présent)",
] as const;

export interface WorksiteSheet {
  id: string;
  user_id: string;
  client_id: string | null;
  civility: string | null;
  client_name: string;
  client_phone: string | null;
  client_phone_backup: string | null;
  contact_person: string | null;
  address: string | null;
  access_complement: string | null;
  intervention_date: string | null;
  intervenant: string | null;
  client_present: boolean | null;
  green_waste: boolean | null;
  equipment: string[];
  epi: string[];
  tasks: string[];
  checklist: string[];
  photos: string[];
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  garden_markers: GardenMarker[];
  recycling_center: RecyclingCenterInfo | null;
  created_at: string;
  updated_at: string;
}

/** Repère positionné sur le plan jardin, associé à une tâche prévue. */
export interface GardenMarker {
  id: string;
  lat: number;
  lng: number;
  task: string;
  note?: string;
}

/** Déchèterie la plus proche enregistrée sur la fiche. */
export interface RecyclingCenterInfo {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  hours: string[];
}

export type WorksiteSheetInput = Omit<
  WorksiteSheet,
  "id" | "user_id" | "created_at" | "updated_at"
>;

function normalize(row: Record<string, unknown>): WorksiteSheet {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
  return {
    ...(row as unknown as WorksiteSheet),
    equipment: arr(row.equipment),
    epi: arr(row.epi),
    tasks: arr(row.tasks),
    checklist: arr(row.checklist),
    photos: arr(row.photos),
    garden_markers: Array.isArray(row.garden_markers) ? (row.garden_markers as GardenMarker[]) : [],
    recycling_center: (row.recycling_center as RecyclingCenterInfo | null) ?? null,
  };
}

export function emptyWorksiteSheet(): WorksiteSheetInput {
  return {
    client_id: null,
    civility: "",
    client_name: "",
    client_phone: "",
    client_phone_backup: "",
    contact_person: "",
    address: "",
    access_complement: "",
    intervention_date: new Date().toISOString().slice(0, 10),
    intervenant: null,
    client_present: null,
    green_waste: null,
    equipment: [],
    epi: [],
    tasks: [],
    checklist: [],
    photos: [],
    notes: "",
    latitude: null,
    longitude: null,
    garden_markers: [],
    recycling_center: null,
  };
}

export async function listWorksiteSheets(): Promise<WorksiteSheet[]> {
  const { data, error } = await supabase
    .from("worksite_sheets")
    .select("*")
    .order("intervention_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function getWorksiteSheet(id: string): Promise<WorksiteSheet> {
  const { data, error } = await supabase.from("worksite_sheets").select("*").eq("id", id).single();
  if (error) throw error;
  return normalize(data as Record<string, unknown>);
}

export async function createWorksiteSheet(input: WorksiteSheetInput): Promise<WorksiteSheet> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const { data, error } = await supabase
    .from("worksite_sheets")
    .insert({ ...input, user_id: auth.user.id })
    .select()
    .single();
  if (error) throw error;
  return normalize(data as Record<string, unknown>);
}

export async function updateWorksiteSheet(id: string, input: WorksiteSheetInput): Promise<WorksiteSheet> {
  const { data, error } = await supabase
    .from("worksite_sheets")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalize(data as Record<string, unknown>);
}

export async function deleteWorksiteSheet(id: string): Promise<void> {
  const { error } = await supabase.from("worksite_sheets").delete().eq("id", id);
  if (error) throw error;
}

/** Upload d'une photo de chantier de fiche, renvoie le chemin de stockage. */
export async function uploadWorksitePhoto(file: File): Promise<string> {
  const { compressImage } = await import("@/lib/storage");
  const blob = await compressImage(file);
  const path = `fiches/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("chantier-photos").upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export async function worksitePhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("chantier-photos")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}