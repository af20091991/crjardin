import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  FolderPlus,
  Loader2,
  Pencil,
  Play,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { listFreePhotos, type FreePhoto } from "@/lib/free-photos";
import { deletePhoto, reorderPhotos, signedPhotoUrl, updatePhoto } from "@/lib/interventions";
import { buildZip } from "@/lib/zip-store";
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
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

interface Album {
  id: string;
  name: string;
  cover_photo_id?: string | null;
  share_token?: string | null;
}

/** Vue affichée : toutes les photos, les photos à classer, ou un album. */
type View = "all" | "unclassified" | string;

const db = () => supabase as unknown as PhotoDb;

/** Au-delà de ce nombre de photos ajoutées d'un coup, on propose de prévenir le client. */
const BULK_NOTICE_THRESHOLD = 5;

async function listAlbums(clientId: string): Promise<Album[]> {
  const { data, error } = await db()
    .from("client_photo_albums")
    .select("id,name,created_at,cover_photo_id,share_token")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Album[];
}

export function PhotoThumb({ path }: { path: string }) {
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
    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <div className="h-full w-full animate-pulse bg-muted" />
  );
}

/**
 * Albums photo d'un client : grille carrée, sélection multiple, glisser-déposer vers un album,
 * réordonnancement par glisser-déposer dans un album, renommage, suppression, diaporama.
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
  const [view, setView] = useState<View>("all");
  const [albumName, setAlbumName] = useState("");
  const [viewer, setViewer] = useState<{ photos: FreePhoto[]; index: number } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{ albumId: string; key: number }>({
    albumId: "",
    key: 0,
  });
  const [notifyCount, setNotifyCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [droppedFiles, setDroppedFiles] = useState<{ files: File[]; key: number } | null>(null);
  const [zipping, setZipping] = useState(false);

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

  const allPhotos = useMemo<FreePhoto[]>(
    () => [...(photos.data ?? [])].sort((a, b) => a.position - b.position),
    [photos.data],
  );
  const allAlbums = useMemo<Album[]>(() => albums.data ?? [], [albums.data]);
  const unclassifiedCount = allPhotos.filter((p) => !p.album_id).length;

  // Si la vue courante (album) disparaît, on revient à « Toutes les photos ».
  useEffect(() => {
    if (view !== "all" && view !== "unclassified" && !allAlbums.some((a) => a.id === view)) {
      setView("all");
    }
  }, [view, allAlbums]);

  const visible = useMemo(() => {
    if (view === "all") return allPhotos;
    if (view === "unclassified") return allPhotos.filter((p) => !p.album_id);
    return allPhotos.filter((p) => p.album_id === view);
  }, [allPhotos, view]);

  const currentAlbum = allAlbums.find((a) => a.id === view) ?? null;
  const selectedIds = [...selected];

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

  const renameAlbum = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await db().from("client_photo_albums").update({ name }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setRenaming(null);
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Renommage impossible."),
  });

  const deleteAlbum = useMutation({
    mutationFn: async (id: string) => {
      // Les photos repassent dans « À classer » (la clé étrangère passe aussi à null).
      const { error } = await db().from("client_photo_albums").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setView("all");
      toast.success("Album supprimé. Ses photos sont dans « À classer ».");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Suppression impossible."),
  });

  const setCover = useMutation({
    mutationFn: async ({ albumId, photoId }: { albumId: string; photoId: string | null }) => {
      const { error } = await db()
        .from("client_photo_albums")
        .update({ cover_photo_id: photoId })
        .eq("id", albumId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSelected(new Set());
      toast.success("Photo de couverture mise à jour.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible."),
  });

  const setShare = useMutation({
    mutationFn: async ({ albumId, enable }: { albumId: string; enable: boolean }) => {
      const token = enable ? crypto.randomUUID() : null;
      const { error } = await db()
        .from("client_photo_albums")
        .update({ share_token: token })
        .eq("id", albumId);
      if (error) throw new Error(error.message);
      return token;
    },
    onSuccess: async (token) => {
      refresh();
      if (token) {
        const link = `${window.location.origin}/album/${token}`;
        try {
          await navigator.clipboard.writeText(link);
          toast.success("Lien copié. Quiconque le possède peut voir cet album.");
        } catch {
          toast.success(`Lien créé : ${link}`);
        }
      } else {
        toast.success("Lien de partage révoqué.");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Partage impossible."),
  });

  const downloadAlbumZip = async (album: Album, list: FreePhoto[]) => {
    if (list.length === 0) return;
    setZipping(true);
    try {
      const entries = [];
      for (const [index, photo] of list.entries()) {
        const url = await signedPhotoUrl(photo.storage_path);
        const response = await fetch(url);
        if (!response.ok) throw new Error("Photo indisponible");
        const ext = photo.storage_path.split(".").pop()?.toLowerCase() ?? "jpg";
        entries.push({
          name: `${String(index + 1).padStart(3, "0")}.${ext}`,
          data: new Uint8Array(await response.arrayBuffer()),
        });
      }
      const blob = buildZip(entries);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${album.name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "album"}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement impossible.");
    } finally {
      setZipping(false);
    }
  };

  const movePhotos = useMutation({
    mutationFn: async ({ ids, albumId }: { ids: string[]; albumId: string | null }) => {
      for (const id of ids) {
        const { error } = await db()
          .from("intervention_photos")
          .update({ album_id: albumId })
          .eq("id", id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Déplacement impossible."),
  });

  const removePhotos = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const photo = allPhotos.find((p) => p.id === id);
        if (photo) await deletePhoto(photo.id, photo.storage_path);
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      toast.success("Photos supprimées.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Suppression impossible."),
  });

  const notifyClient = useMutation({
    mutationFn: async (count: number) => {
      const rpc = supabase as unknown as {
        rpc: (
          fn: "request_client_photo_notice",
          args: { p_client: string; p_count: number },
        ) => Promise<{ error: { message: string } | null }>;
      };
      const { error } = await rpc.rpc("request_client_photo_notice", {
        p_client: clientId,
        p_count: count,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNotifyCount(null);
      toast.success("Demande envoyée : le client sera prévenu après validation.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Demande impossible."),
  });

  const handleUploaded = (count: number) => {
    refresh();
    if (count >= BULK_NOTICE_THRESHOLD) setNotifyCount(count);
  };

  /** Déplace la photo glissée (ou toute la sélection si elle en fait partie) dans un album. */
  const dropOnAlbum = (albumId: string | null) => {
    if (!dragId) return;
    const ids = selected.has(dragId) ? selectedIds : [dragId];
    setDragId(null);
    movePhotos.mutate({ ids, albumId });
  };

  /** Réordonne dans un album : la photo glissée prend la place de la cible. */
  const dropOnPhoto = (targetId: string) => {
    if (!dragId || dragId === targetId || view === "all" || view === "unclassified") return;
    const ids = visible.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderPhotos(ids)
      .then(() => refresh())
      .catch(() => toast.error("Réordonnancement impossible."));
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openViewer = (photo: FreePhoto) =>
    setViewer({ photos: visible, index: visible.findIndex((p) => p.id === photo.id) });

  const viewTitle =
    view === "all"
      ? "Toutes les photos"
      : view === "unclassified"
        ? "À classer"
        : (currentAlbum?.name ?? "Album");

  const chip = (id: View, label: string, count: number, extra?: React.ReactNode) => {
    const active = view === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setView(id)}
        onDragOver={(event) => {
          if (dragId && id !== "unclassified") event.preventDefault();
          if (dragId && id === "unclassified") event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (id === "all") return;
          dropOnAlbum(id === "unclassified" ? null : id);
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card hover:border-primary/50"
        } ${dragId && id !== "all" ? "ring-2 ring-primary/30" : ""}`}
      >
        {label}
        <span className={active ? "opacity-80" : "text-muted-foreground"}>{count}</span>
        {extra}
      </button>
    );
  };

  const name = albumName.trim();

  return (
    <div
      className="space-y-4"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) {
          toast.error("Seules les images peuvent être déposées ici.");
          return;
        }
        const albumId = view !== "all" && view !== "unclassified" ? view : "";
        const key = uploadTarget.key + 1;
        setUploadTarget({ albumId, key });
        setDroppedFiles({ files, key });
        setUploadOpen(true);
      }}
    >
      {viewer !== null && (
        <PhotoViewer
          photos={viewer.photos}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
          onCaptionSave={async (id, caption) => {
            await updatePhoto(id, { caption: caption || null });
            refresh();
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (uploadOpen) {
                setUploadOpen(false);
                return;
              }
              const albumId = view !== "all" && view !== "unclassified" ? view : "";
              setUploadTarget((t) => ({ albumId, key: t.key + 1 }));
              setUploadOpen(true);
            }}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Importer des photos
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${uploadOpen ? "rotate-180" : ""}`}
            />
          </Button>
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Affichage">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={layout === mode}
                onClick={() => setLayout(mode)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${layout === mode ? "bg-muted text-foreground" : "text-muted-foreground"}`}
              >
                {mode === "grid" ? "Grille" : "Liste"}
              </button>
            ))}
          </div>
          {currentAlbum && visible.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => openViewer(visible[0])}>
              <Play className="mr-1.5 h-4 w-4" />
              Diaporama
            </Button>
          )}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name && !createAlbum.isPending) createAlbum.mutate(name);
          }}
        >
          <Input
            className="h-9 w-44"
            maxLength={100}
            value={albumName}
            onChange={(event) => setAlbumName(event.target.value)}
            placeholder="Nouvel album"
            aria-label="Nom du nouvel album"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!name || createAlbum.isPending}
          >
            {createAlbum.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="mr-1.5 h-4 w-4" />
            )}
            Créer
          </Button>
        </form>
      </div>

      {uploadOpen && (
        <div id="photo-uploader">
          <DashboardPhotoUploader
            key={uploadTarget.key}
            clientId={clientId}
            interventions={interventions}
            onUploaded={handleUploaded}
            defaultAlbumId={uploadTarget.albumId || undefined}
            initialFiles={droppedFiles?.key === uploadTarget.key ? droppedFiles.files : undefined}
          />
        </div>
      )}

      {notifyCount !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <span>
            {notifyCount} photos ajoutées. Prévenir le client par notification et e-mail ?
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNotifyCount(null)}>
              Non
            </Button>
            <Button
              size="sm"
              disabled={notifyClient.isPending}
              onClick={() => notifyClient.mutate(notifyCount)}
            >
              Prévenir le client
            </Button>
          </div>
        </div>
      )}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chip("all", "Toutes", allPhotos.length)}
        {chip("unclassified", "À classer", unclassifiedCount)}
        {allAlbums.map((album) =>
          chip(album.id, album.name, allPhotos.filter((p) => p.album_id === album.id).length),
        )}
      </div>

      {(photos.isLoading || albums.isLoading) && (
        <p className="text-sm text-muted-foreground">Chargement des photos…</p>
      )}
      {(photos.error || albums.error) && (
        <p className="text-sm text-destructive">Photos indisponibles pour le moment.</p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {currentAlbum && renaming?.id === currentAlbum.id ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = renaming.value.trim();
                if (value) renameAlbum.mutate({ id: currentAlbum.id, name: value });
              }}
            >
              <Input
                className="h-9 w-56"
                maxLength={100}
                autoFocus
                value={renaming.value}
                onChange={(event) =>
                  setRenaming({ id: currentAlbum.id, value: event.target.value })
                }
                aria-label="Nouveau nom de l'album"
              />
              <Button type="submit" size="sm" disabled={renameAlbum.isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              {currentAlbum?.cover_photo_id && (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                  <PhotoThumb
                    path={
                      allPhotos.find((p) => p.id === currentAlbum.cover_photo_id)?.storage_path ??
                      ""
                    }
                  />
                </div>
              )}
              <h3 className="font-serif text-lg font-semibold">
                {viewTitle}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({visible.length})
                </span>
              </h3>
            </div>
          )}
          {currentAlbum && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={visible.length === 0 || zipping}
                onClick={() => void downloadAlbumZip(currentAlbum, visible)}
              >
                {zipping ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Télécharger (ZIP)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={setShare.isPending}
                onClick={() =>
                  currentAlbum.share_token
                    ? void navigator.clipboard
                        .writeText(`${window.location.origin}/album/${currentAlbum.share_token}`)
                        .then(() => toast.success("Lien copié."))
                        .catch(() => toast.error("Copie impossible."))
                    : setShare.mutate({ albumId: currentAlbum.id, enable: true })
                }
              >
                Partager
              </Button>
              {currentAlbum.share_token && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={setShare.isPending}
                  onClick={() => setShare.mutate({ albumId: currentAlbum.id, enable: false })}
                >
                  Arrêter le partage
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRenaming({ id: currentAlbum.id, value: currentAlbum.name })}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Renommer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={deleteAlbum.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Supprimer l'album « ${currentAlbum.name} » ? Les photos restent et passent dans « À classer ».`,
                    )
                  )
                    deleteAlbum.mutate(currentAlbum.id);
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Supprimer
              </Button>
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 shadow-sm">
            <span className="px-1 text-sm font-medium">{selected.size} sélectionnée(s)</span>
            <select
              aria-label="Déplacer la sélection vers un album"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value=""
              disabled={movePhotos.isPending}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "__none__") movePhotos.mutate({ ids: selectedIds, albumId: null });
                else if (value) movePhotos.mutate({ ids: selectedIds, albumId: value });
              }}
            >
              <option value="">Déplacer vers…</option>
              <option value="__none__">À classer</option>
              {allAlbums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            {currentAlbum && selected.size === 1 && (
              <Button
                variant="outline"
                size="sm"
                disabled={setCover.isPending}
                onClick={() =>
                  setCover.mutate({ albumId: currentAlbum.id, photoId: selectedIds[0] })
                }
              >
                Définir comme couverture
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={removePhotos.isPending}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement ${selected.size} photo(s) ?`))
                  removePhotos.mutate(selectedIds);
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Supprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Annuler
            </Button>
          </div>
        )}

        {visible.length === 0 && !photos.isLoading ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {view === "unclassified"
              ? "Aucune photo à classer."
              : currentAlbum
                ? "Cet album est vide. Glissez des photos ici ou utilisez « Importer des photos »."
                : "Aucune photo pour ce client."}
          </p>
        ) : (
          <ul
            className={
              layout === "grid"
                ? "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
                : "space-y-2"
            }
          >
            {visible.map((photo) => {
              const isSelected = selected.has(photo.id);
              return (
                <li
                  key={photo.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", photo.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDragId(photo.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(event) => {
                    if (dragId && dragId !== photo.id) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropOnPhoto(photo.id);
                  }}
                  className={`group relative rounded-lg border bg-card ${
                    layout === "grid" ? "overflow-hidden" : "flex items-center gap-3 p-2"
                  } ${isSelected ? "ring-2 ring-primary" : ""} ${dragId === photo.id ? "opacity-50" : ""}`}
                >
                  <button
                    type="button"
                    aria-label="Agrandir la photo"
                    className={`block overflow-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                      layout === "grid" ? "aspect-square w-full" : "h-14 w-14 shrink-0 rounded-md"
                    }`}
                    onClick={() => openViewer(photo)}
                  >
                    <PhotoThumb path={photo.storage_path} />
                  </button>
                  <button
                    type="button"
                    aria-label={isSelected ? "Désélectionner" : "Sélectionner"}
                    aria-pressed={isSelected}
                    onClick={() => toggleSelect(photo.id)}
                    className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border bg-background/90 transition-opacity ${
                      isSelected
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                  {layout === "list" && (
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {photo.caption ?? "Sans légende"}
                    </span>
                  )}
                  <select
                    aria-label="Classer la photo dans un album"
                    className={`h-7 rounded-md border bg-background/95 px-1 text-[11px] transition-opacity ${
                      layout === "list"
                        ? "ml-auto w-40 shrink-0"
                        : "absolute inset-x-1 bottom-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    }`}
                    value={photo.album_id ?? ""}
                    disabled={movePhotos.isPending}
                    onChange={(event) =>
                      movePhotos.mutate({
                        ids: [photo.id],
                        albumId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">À classer</option>
                    {allAlbums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
        {visible.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Glissez une photo sur un album pour la classer, ou sur une autre photo d'un album pour
            la réordonner. Cliquez sur le rond pour sélectionner plusieurs photos.
          </p>
        )}
      </section>
    </div>
  );
}
