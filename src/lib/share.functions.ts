import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface SharedTask {
  id: string;
  label: string;
  status: string | null;
  note: string | null;
}

export interface SharedPhoto {
  id: string;
  storage_path: string;
  caption: string | null;
  url: string | null;
}

export interface SharedIntervention {
  id: string;
  title: string | null;
  reference: string | null;
  intervention_date: string;
  intervention_type: string | null;
  summary: string | null;
  garden_state: string | null;
  upcoming_works: string | null;
  recommendations_text: string | null;
  tasks: SharedTask[];
  photos: SharedPhoto[];
}

export interface SharedClientData {
  client: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    contract_type: string | null;
    frequency: string | null;
  };
  interventions: SharedIntervention[];
}

const BUCKET = "chantier-photos";

export const getSharedClient = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token || typeof data.token !== "string") throw new Error("Lien invalide");
    return { token: data.token };
  })
  .handler(async ({ data }): Promise<SharedClientData | null> => {
    const publicClient = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: payload, error } = await publicClient.rpc("get_shared_client", {
      p_token: data.token,
    });
    if (error) throw error;
    if (!payload) return null;

    const result = payload as unknown as SharedClientData;

    // Sign photo URLs with the admin client (private bucket).
    const paths = result.interventions.flatMap((iv) => iv.photos.map((p) => p.storage_path));
    if (paths.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrls(paths, 60 * 60 * 24 * 7);
      const map = new Map<string, string>();
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
      });
      result.interventions.forEach((iv) => {
        iv.photos.forEach((p) => {
          p.url = map.get(p.storage_path) ?? null;
        });
      });
    }

    return result;
  });
