import { supabase } from "@/integrations/supabase/client";

/** Listes de référence reprises de l'outil « Fiche chantier » SST. */
export const INTERVENANTS = ["Chloé", "Fanny", "Angélique", "Lionel"] as const;

export const EQUIPMENT_GROUPS: { group: string; items: string[] }[] = [
  { group: "Taille-haie", items: ["Taille-haie thermique", "Taille-haie sur perche", "Sécateur électrique"] },
  { group: "Motorisé", items: ["Tondeuse", "Débroussailleuse", "Souffleur", "Tronçonneuse", "Scarificateur"] },
  { group: "Outils à main", items: ["Sécateur", "Cisaille", "Râteau", "Bêche", "Balai à gazon", "Serpette"] },
  { group: "Accessoires", items: ["Bâche", "Sacs à déchets verts", "Brouette", "Rallonge", "Échelle"] },
  { group: "Batterie", items: ["Batteries chargées", "Chargeur", "Carburant / mélange"] },
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
  { group: "Taille de haie", items: ["Taille de haie", "Taille de haie en hauteur", "Évacuation des tailles"] },
  { group: "Élagage & arbres", items: ["Élagage", "Abattage", "Démontage", "Broyage des branches"] },
  { group: "Entretien de pelouse", items: ["Tonte", "Tonte des bordures", "Scarification", "Semis / regarnissage"] },
  { group: "Entretien de massif", items: ["Désherbage massif", "Binage", "Paillage", "Plantation"] },
  { group: "Débroussaillage", items: ["Débroussaillage", "Fauchage", "Nettoyage de friche"] },
  { group: "Nettoyage & finitions", items: ["Soufflage", "Nettoyage des allées", "Ramassage des feuilles"] },
  { group: "Évacuation", items: ["Évacuation des déchets verts", "Chargement remorque"] },
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
  created_at: string;
  updated_at: string;
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