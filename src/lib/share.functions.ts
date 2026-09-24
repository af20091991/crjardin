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
  sent_to_client_at: string | null;
  has_sent_pdf: boolean;
  has_pdf: boolean;
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

export interface SharedPremiumDocument {
  id: string;
  title: string;
  filename: string;
  size_bytes: number | null;
  uploaded_by: "gardener" | "client";
  created_at: string;
  url: string | null;
}

export interface SharedPremiumUpcoming {
  id: string;
  scheduled_date: string;
  title: string;
  details: string | null;
}

export interface SharedPremiumData {
  enabled: boolean;
  garden_state: string | null;
  google_review_url: string | null;
  commercial_note: string | null;
  cover_photo_url: string | null;
  documents: SharedPremiumDocument[];
  upcoming: SharedPremiumUpcoming[];
}

const BUCKET = "chantier-photos";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
    const { data: rows, error } = await publicClient().rpc("get_shared_messages", {
      p_token: data.token,
    });
    if (error) throw error;
    return (rows as unknown as ClientMessage[]) ?? [];
  });

export const addClientMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      interventionId: string | null;
      kind: string;
      content: string;
      authorName?: string | null;
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
    },
  )
  .handler(async ({ data }) => {
    const { data: msgId, error } = await publicClient().rpc("add_client_message", {
      p_token: data.token,
      p_intervention_id: data.interventionId as string,
      p_kind: data.kind,
      p_content: data.content,
      p_author_name: data.authorName ?? undefined,
    });
    if (error) throw error;

    // Email au jardinier — best-effort, ne doit jamais faire échouer l'envoi
    // du message côté client. La notification PP (table notifications) est
    // déjà garantie par la fonction SQL ci-dessus.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id, name, user_id")
        .eq("share_token", data.token)
        .maybeSingle();
      if (client) {
        const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(client.user_id);
        const email = userRes.user?.email;
        if (email) {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await sendTemplateEmail("client-activity", email, {
            templateData: {
              clientName: client.name,
              actionText:
                data.kind === "question" ? "a posé une question" : "a ajouté une annotation",
              contentPreview: data.content,
              clientUrl: `https://crjardin.lovable.app/clients/${client.id}`,
            },
            idempotencyKey: `client-message-${msgId as string}`,
          });
        }
      }
    } catch {
      // best-effort
    }

    return { ok: true };
  });

export const setRecommendationInterest = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      recoId: string;
      interest: "interested" | "not_interested" | "none";
    }) => {
      if (!data?.token) throw new Error("Lien invalide");
      if (!data?.recoId) throw new Error("Préconisation invalide");
      if (!["interested", "not_interested", "none"].includes(data.interest))
        throw new Error("Choix invalide");
      return { token: data.token, recoId: data.recoId, interest: data.interest };
    },
  )
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

const PREMIUM_BUCKET = "client-premium";

export const getSharedPremium = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token || typeof data.token !== "string") throw new Error("Lien invalide");
    return { token: data.token };
  })
  .handler(async ({ data }): Promise<SharedPremiumData | null> => {
    const { data: payload, error } = await publicClient().rpc("get_shared_premium", {
      p_token: data.token,
    });
    if (error) throw error;
    if (!payload) return null;

    const raw = payload as unknown as {
      enabled: boolean;
      garden_state: string | null;
      google_review_url: string | null;
      commercial_note: string | null;
      cover_photo_id: string | null;
      documents: Array<{
        id: string;
        title: string;
        filename: string;
        storage_path: string;
        size_bytes: number | null;
        uploaded_by: "gardener" | "client";
        created_at: string;
      }>;
      upcoming: SharedPremiumUpcoming[];
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let coverPhotoUrl: string | null = null;
    if (raw.cover_photo_id) {
      const { data: photo } = await supabaseAdmin
        .from("intervention_photos")
        .select("storage_path")
        .eq("id", raw.cover_photo_id)
        .maybeSingle();
      if (photo?.storage_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(photo.storage_path, 60 * 60 * 24 * 7);
        coverPhotoUrl = signed?.signedUrl ?? null;
      }
    }

    const docPaths = raw.documents.map((d) => d.storage_path);
    const docUrlMap = new Map<string, string>();
    if (docPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from(PREMIUM_BUCKET)
        .createSignedUrls(docPaths, 60 * 60 * 24);
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) docUrlMap.set(s.path, s.signedUrl);
      });
    }

    return {
      enabled: raw.enabled,
      garden_state: raw.garden_state,
      google_review_url: raw.google_review_url,
      commercial_note: raw.commercial_note,
      cover_photo_url: coverPhotoUrl,
      upcoming: raw.upcoming,
      documents: raw.documents.map((d) => ({
        id: d.id,
        title: d.title,
        filename: d.filename,
        size_bytes: d.size_bytes,
        uploaded_by: d.uploaded_by,
        created_at: d.created_at,
        url: docUrlMap.get(d.storage_path) ?? null,
      })),
    };
  });

/**
 * Renvoie une URL signée vers la version du compte-rendu **envoyée au client**
 * (`sent_pdf_storage_path`). Journalise également l'événement
 * `viewed_by_client` dans l'historique.
 */
export const getSharedInterventionPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; interventionId: string }) => {
    if (!data?.token) throw new Error("Lien invalide");
    if (!data?.interventionId) throw new Error("Compte-rendu invalide");
    return { token: data.token, interventionId: data.interventionId };
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const fwd = getRequestHeader("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0].trim() || getRequestHeader("cf-connecting-ip") || null;
    const ua = getRequestHeader("user-agent") ?? null;
    const { data: payload, error } = await publicClient().rpc("record_shared_report_view", {
      p_token: data.token,
      p_intervention_id: data.interventionId,
      p_user_agent: ua ?? undefined,
      p_ip: ip ?? undefined,
    });
    if (error) throw error;
    const path = (payload as { pdf_storage_path?: string } | null)?.pdf_storage_path;
    if (!path) throw new Error("Aucun PDF disponible");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("intervention-reports")
      .createSignedUrl(path, 60 * 60);
    if (signErr) throw signErr;
    return { url: signed.signedUrl };
  });

const PREMIUM_DOC_MAX_BYTES = 15 * 1024 * 1024;

async function requireEnabledPremiumClient(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, name, user_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!client) throw new Error("Lien invalide");
  const { data: premium } = await supabaseAdmin
    .from("client_premium")
    .select("enabled")
    .eq("client_id", client.id)
    .maybeSingle();
  if (!premium?.enabled) throw new Error("Espace Premium non actif");
  return { supabaseAdmin, client };
}

/** Étape 1 — prépare une URL d'upload signée pour un document déposé par le client. */
export const createSharedPremiumDocumentUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; filename: string; size: number }) => {
    if (!data?.token) throw new Error("Lien invalide");
    if (!data.filename) throw new Error("Nom de fichier invalide");
    if (!Number.isFinite(data.size) || data.size <= 0 || data.size > PREMIUM_DOC_MAX_BYTES) {
      throw new Error("Le fichier ne doit pas dépasser 15 Mo");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin, client } = await requireEnabledPremiumClient(data.token);
    const ext = data.filename.split(".").pop() || "bin";
    const path = `${client.id}/client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(PREMIUM_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed?.token) {
      throw new Error(
        `Préparation de l'envoi impossible : ${error?.message ?? "URL signée indisponible"}`,
      );
    }
    return { path, token: signed.token };
  });

/** Étape 2 — vérifie l'upload, enregistre le document et notifie le jardinier. */
export const finalizeSharedPremiumDocumentUpload = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { token: string; path: string; filename: string; size: number; title: string }) => {
      if (!data?.token) throw new Error("Lien invalide");
      if (!data.path) throw new Error("Chemin invalide");
      if (!data.title || data.title.trim().length === 0) throw new Error("Titre requis");
      return { ...data, title: data.title.trim().slice(0, 200) };
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, client } = await requireEnabledPremiumClient(data.token);
    if (!data.path.startsWith(`${client.id}/`)) throw new Error("Chemin de fichier invalide");
    const filename = data.path.split("/").pop()!;
    const { data: listed, error: listError } = await supabaseAdmin.storage
      .from(PREMIUM_BUCKET)
      .list(client.id, { search: filename, limit: 1 });
    if (listError || !listed?.some((f) => f.name === filename)) {
      throw new Error("Le fichier n'a pas été reçu par le stockage");
    }

    const { error } = await publicClient().rpc("add_client_premium_document", {
      p_token: data.token,
      p_title: data.title,
      p_filename: data.filename,
      p_storage_path: data.path,
      p_size_bytes: data.size,
    });
    if (error) throw error;

    try {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(client.user_id);
      const email = userRes.user?.email;
      if (email) {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("client-activity", email, {
          templateData: {
            clientName: client.name,
            actionText: "a ajouté un document",
            contentPreview: data.title,
            clientUrl: `https://crjardin.lovable.app/clients/${client.id}`,
          },
          idempotencyKey: `client-premium-document-${data.path}`,
        });
      }
    } catch {
      // best-effort
    }

    return { ok: true };
  });
