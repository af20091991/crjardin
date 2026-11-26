import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CLIENT_APK_URL } from "@/lib/mobile-update";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

const IOS_STEPS = [
  "Touchez le bouton Partager en bas de l'écran (le carré avec une flèche).",
  "Faites défiler et choisissez « Sur l'écran d'accueil ».",
  "Validez avec « Ajouter ». L'icône Mon jardin s'ouvre directement sur votre espace.",
];

/**
 * Bouton d'installation de l'espace Premium.
 * - Android : téléchargement de l'application (APK).
 * - iPhone : raccourci sur l'écran d'accueil, avec les étapes affichées.
 * - Autre (ordinateur) : installation native du navigateur si elle est proposée.
 * Le manifeste est remplacé par une version dédiée dont l'adresse de démarrage
 * est son lien privé, pour que l'icône ouvre directement son espace.
 */
export function PremiumInstall({ variant = "compact" }: { variant?: "compact" | "card" }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
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
  if (platform === "other" && !prompt) return null;

  const label =
    platform === "android"
      ? "Télécharger l'application"
      : platform === "ios"
        ? "Ajouter à l'écran d'accueil"
        : "Installer l'application";
  const buttonClass =
    variant === "card" ? "h-12 gap-2 px-6 text-base" : "h-10 gap-1.5 px-4 text-sm font-semibold";

  if (platform === "android") {
    return (
      <Button asChild className={buttonClass}>
        <a href={CLIENT_APK_URL} rel="noopener noreferrer" download>
          <Download className="size-4" />
          {label}
        </a>
      </Button>
    );
  }

  if (platform === "ios") {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button className={buttonClass}>
            <Smartphone className="size-4" />
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter Mon jardin à votre iPhone</DialogTitle>
            <DialogDescription>
              Ouvrez cette page dans Safari, puis suivez ces trois étapes.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-3 pl-5 text-base leading-7">
            {IOS_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Button
      className={buttonClass}
      onClick={async () => {
        if (!prompt) return;
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
        setPrompt(null);
      }}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
