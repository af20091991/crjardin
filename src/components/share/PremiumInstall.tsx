import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Permet au client d'ajouter son espace Premium à l'écran d'accueil.
 * Le manifeste est remplacé par une version dédiée dont l'adresse de démarrage
 * est son lien privé, pour que l'icône ouvre directement son espace.
 */
export function PremiumInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const originalHref = link?.getAttribute("href") ?? null;
    let blobUrl: string | null = null;
    if (link) {
      const manifest = {
        name: "Le carnet du jardin",
        short_name: "Mon jardin",
        description: "Votre espace Premium De la graine au jardin.",
        start_url: window.location.pathname + window.location.search,
        scope: "/partage/",
        display: "standalone",
        background_color: "#F9F7F2",
        theme_color: "#4F8E33",
        icons: [
          { src: `${window.location.origin}/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${window.location.origin}/icon-512.png`, sizes: "512x512", type: "image/png" },
        ],
      };
      blobUrl = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
      );
      link.setAttribute("href", blobUrl);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (link && originalHref) link.setAttribute("href", originalHref);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      isIos
        ? "Touchez le bouton Partager de Safari, puis « Sur l'écran d'accueil »."
        : "Ouvrez le menu de votre navigateur, puis « Ajouter à l'écran d'accueil ».",
      { duration: 9000 },
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 text-primary"
      onClick={install}
      aria-label="Ajouter à l'écran d'accueil"
    >
      <Smartphone className="size-4" />
      <span className="hidden sm:inline">Écran d'accueil</span>
    </Button>
  );
}
