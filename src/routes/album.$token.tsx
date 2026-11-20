import { createFileRoute, lazyRouteComponent, notFound } from "@tanstack/react-router";
import { getSharedAlbum } from "@/lib/album-share.functions";

// prettier-ignore
export const Route = createFileRoute("/album/$token")({
  loader: async ({ params }) => {
    const album = await getSharedAlbum({ data: { token: params.token } });
    if (!album) throw notFound();
    return album;
  },
  head: () => ({
    meta: [
      { title: "Album photo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/album.$token"), "SharedAlbumPage"),
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-muted/30 p-6 text-center">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Lien introuvable</h1>
        <p className="mt-2 text-muted-foreground">Cet album n'est plus partagé ou le lien est invalide.</p>
      </div>
    </div>
  ),
});
