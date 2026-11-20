import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { listFreePhotos, type FreePhoto } from "@/lib/free-photos";
import { signedPhotoUrl } from "@/lib/interventions";
import { PhotoViewer } from "@/components/clients/PhotoViewer";
import {
  DashboardPhotoUploader,
  type UploadableIntervention,
} from "@/components/premium-admin/DashboardPhotoUploader";

/** Accès aux tables photos non encore reflétées dans types.ts (régénération à faire). */
type PhotoDb = {
  from: (table: "client_photo_albums" | "intervention_photos") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

interface Album {
  id: string;
  name: string;
}

const db = () => supabase as unknown as PhotoDb;

async function listAlbums(clientId: string): Promise<Album[]> {
  const { data, error } = await db()
    .from("client_photo_albums")
    .select("id,name,created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Album[];
}

function PhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedPhotoUrl(path)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return url ? (
    <img src={url} alt="" loading="lazy" className="h-24 w-full rounded-md object-cover" />
  ) : (
    <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
  );
}

/**
 * Albums et photos libres d'un client, accessibles à tout client (Premium ou non).
 * Les photos des comptes-rendus restent dans leurs interventions : elles ne sont jamais listées ici.
 */
export function ClientPhotosPanel({
  clientId,
  interventions,
}: {
  clientId: string;
  interventions: UploadableIntervention[];
}) {
  const qc = useQueryClient();
  const [albumName, setAlbumName] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const photosKey = ["client-free-photos", clientId] as const;
  const albumsKey = ["client-photo-albums", clientId] as const;
  const photos = useQuery({
    queryKey: photosKey,
    queryFn: () => listFreePhotos(clientId),
  });
  const albums = useQuery({
    queryKey: albumsKey,
    queryFn: () => listAlbums(clientId),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: photosKey });
    void qc.invalidateQueries({ queryKey: albumsKey });
  };

  const createAlbum = useMutation({
    mutationFn: async (name: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Non authentifié");
      const { error } = await db()
        .from("client_photo_albums")
        .insert({ client_id: clientId, user_id: auth.user.id, name });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setAlbumName("");
      toast.success("Album créé.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Création impossible."),
  });

  const movePhoto = useMutation({
    mutationFn: async ({ photoId, albumId }: { photoId: string; albumId: string | null }) => {
      const { error } = await db()
        .from("intervention_photos")
        .update({ album_id: albumId })
        .eq("id", photoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => refresh(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Déplacement impossible."),
  });

  const allPhotos: FreePhoto[] = photos.data ?? [];
  const allAlbums: Album[] = albums.data ?? [];
  const unclassified = allPhotos.filter((p) => !p.album_id);
  const name = albumName.trim();

  const renderPhoto = (photo: FreePhoto) => (
    <li key={photo.id} className="space-y-1.5">
      <button
        type="button"
        className="block w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Agrandir la photo"
        onClick={() => setViewerIndex(allPhotos.findIndex((p) => p.id === photo.id))}
      >
        <PhotoThumb path={photo.storage_path} />
      </button>
      <select
        aria-label="Classer la photo dans un album"
        className="h-9 w-full rounded-md border bg-background px-2 text-xs"
        value={photo.album_id ?? ""}
        disabled={movePhoto.isPending}
        onChange={(event) =>
          movePhoto.mutate({ photoId: photo.id, albumId: event.target.value || null })
        }
      >
        <option value="">Photos à classer</option>
        {allAlbums.map((album) => (
          <option key={album.id} value={album.id}>
            {album.name}
          </option>
        ))}
      </select>
    </li>
  );

  return (
    <div className="space-y-5">
      {viewerIndex !== null && (
        <PhotoViewer
          photos={allPhotos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
      <DashboardPhotoUploader
        clientId={clientId}
        interventions={interventions}
        onUploaded={refresh}
      />

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name && !createAlbum.isPending) createAlbum.mutate(name);
        }}
      >
        <Input
          className="min-w-40 flex-1"
          maxLength={100}
          value={albumName}
          onChange={(event) => setAlbumName(event.target.value)}
          placeholder="Nom du nouvel album"
          aria-label="Nom du nouvel album"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!name || createAlbum.isPending}>
          {createAlbum.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FolderPlus className="mr-1.5 h-4 w-4" />
          )}
          Créer l'album
        </Button>
      </form>

      {(photos.isLoading || albums.isLoading) && (
        <p className="text-sm text-muted-foreground">Chargement des photos…</p>
      )}
      {(photos.error || albums.error) && (
        <p className="text-sm text-destructive">Photos indisponibles pour le moment.</p>
      )}

      {allAlbums.map((album) => {
        const inAlbum = allPhotos.filter((p) => p.album_id === album.id);
        return (
          <section key={album.id} className="space-y-2">
            <h3 className="font-serif text-lg font-semibold">
              {album.name}{" "}
              <span className="text-sm font-normal text-muted-foreground">({inAlbum.length})</span>
            </h3>
            {inAlbum.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{inAlbum.map(renderPhoto)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune photo dans cet album.</p>
            )}
          </section>
        );
      })}

      {unclassified.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-serif text-lg font-semibold">
            Photos à classer{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({unclassified.length})
            </span>
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{unclassified.map(renderPhoto)}</ul>
        </section>
      )}
    </div>
  );
}
