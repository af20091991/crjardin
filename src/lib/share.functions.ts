import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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
  client_read_at: string | null;
  tasks: SharedTask[];
  photos: SharedPhoto[];
}

export interface SharedRecommendation {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  estimated_hours: number | null;
  unit_price: number;
  client_interest: string | null;
  client_viewed_at: string | null;
}

export interface SharedClientData {
  client: {
    id: string;
    name: string;
    civility?: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    contract_type: string | null;
    frequency: string | null;
  };
  recommendations: SharedRecommendation[];
  interventions: SharedIntervention[];
}

const BUCKET = "chantier-photos";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface ClientMessage {
  id: string;
  intervention_id: string | null;
  kind: string;
  content: string;
  author_name: string | null;
  sender: string;
  created_at: string;
}

export const markSharedRead = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token) throw new Error("Lien invalide");
    return { token: data.token };
  })
  .handler(async ({ data }) => {
    const fwd = getRequestHeader("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0].trim() || getRequestHeader("cf-connecting-ip") || null;
    const ua = getRequestHeader("user-agent") ?? null;
    const { error } = await publicClient().rpc("mark_shared_read", {
      p_token: data.token,
      p_user_agent: ua ?? undefined,
      p_ip: ip ?? undefined,
    });
    if (error) throw error;
    return { ok: true };
  });

export const markRecommendationsViewed = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token) throw new Error("Lien invalide");
    return { token: data.token };
  })
  .handler(async ({ data }) => {
    const fwd = getRequestHeader("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0].trim() || getRequestHeader("cf-connecting-ip") || null;
    const ua = getRequestHeader("user-agent") ?? null;
    const { error } = await publicClient().rpc("mark_recommendations_viewed", {
      p_token: data.token,
      p_user_agent: ua ?? undefined,
      p_ip: ip ?? undefined,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getSharedMessages = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token) throw new Error("Lien invalide");
    return { token: data.token };
  })
  .handler(async ({ data }): Promise<ClientMessage[]> => {
    const { data: rows, error } = await publicClient().rpc("get_shared_messages", { p_token: data.token });
    if (error) throw error;
    return (rows as unknown as ClientMessage[]) ?? [];
  });

export const addClientMessage = createServerFn({ method: "POST" })
  .inputValidator((data: {
    token: string; interventionId: string | null; kind: string; content: string; authorName?: string | null;
  }) => {
    if (!data?.token) throw new Error("Lien invalide");
    if (!data.content || data.content.trim().length === 0) throw new Error("Message vide");
    return {
      token: data.token,
      interventionId: data.interventionId ?? null,
      kind: data.kind === "question" ? "question" : "annotation",
      content: data.content.trim().slice(0, 2000),
      authorName: data.authorName ?? null,
    };
  })
  .handler(async ({ data }) => {
    const { error } = await publicClient().rpc("add_client_message", {
      p_token: data.token,
      p_intervention_id: data.interventionId as string,
      p_kind: data.kind,
      p_content: data.content,
      p_author_name: data.authorName ?? undefined,
    });
    if (error) throw error;
    return { ok: true };
  });

export const setRecommendationInterest = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; recoId: string; interest: "interested" | "not_interested" | "none" }) => {
    if (!data?.token) throw new Error("Lien invalide");
    if (!data?.recoId) throw new Error("Préconisation invalide");
    if (!["interested", "not_interested", "none"].includes(data.interest)) throw new Error("Choix invalide");
    return { token: data.token, recoId: data.recoId, interest: data.interest };
  })
  .handler(async ({ data }) => {
    const { error } = await publicClient().rpc("set_recommendation_interest", {
      p_token: data.token,
      p_reco_id: data.recoId,
      p_interest: data.interest,
    });
    if (error) throw error;
    return { ok: true };
  });

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
