import { createServerFn } from "@tanstack/react-start";

export interface SharedAlbumPhoto {
  id: string;
  url: string;
  caption: string | null;
}

export interface SharedAlbum {
  name: string;
  photos: SharedAlbumPhoto[];
}

/** Lecture publique d'un album partagé par lien. Le jeton est aléatoire et révocable. */
export const getSharedAlbum = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token || !/^[0-9a-f-]{36}$/i.test(data.token)) throw new Error("Lien invalide");
    return { token: data.token };
  })
  .handler(async ({ data }): Promise<SharedAlbum | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            order: (
              column: string,
              options: { ascending: boolean },
            ) => Promise<{ data: unknown[] | null; error: unknown }>;
          };
        };
      };
    };

    const { data: album } = await db
      .from("client_photo_albums")
      .select("id,name")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!album) return null;
    const row = album as { id: string; name: string };

    const { data: photosData } = await db
      .from("intervention_photos")
      .select("id,storage_path,caption")
      .eq("album_id", row.id)
      .order("position", { ascending: true });

    const rows = (photosData ?? []) as {
      id: string;
      storage_path: string;
      caption: string | null;
    }[];
    const photos: SharedAlbumPhoto[] = [];
    for (const photo of rows) {
      const { data: signed } = await supabaseAdmin.storage
        .from("chantier-photos")
        .createSignedUrl(photo.storage_path, 60 * 60);
      if (signed?.signedUrl)
        photos.push({ id: photo.id, url: signed.signedUrl, caption: photo.caption });
    }
    return { name: row.name, photos };
  });
