import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share2, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also check on appinstalled
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: "De la graine au jardin — Suivi de jardin",
      text: "Découvrez l'application de suivi d'entretien paysager De la graine au jardin.",
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`);
        // We'll let the caller handle the toast
      } catch {
        // Clipboard failed
      }
    }
  };

  if (isInstalled) return null;

  return (
    <>
      {/* Mobile install banner */}
      {isVisible && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-sm px-4 md:hidden">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Installer l'application</p>
              <p className="text-xs text-muted-foreground">Ajoutez De la graine au jardin à votre écran d'accueil.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" className="h-8" onClick={handleInstall}>
                <Download className="mr-1 h-3.5 w-3.5" /> Installer
              </Button>
              <button
                onClick={() => setIsVisible(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share button — shown on all devices when not installed */}
      {!isVisible && (
        <button
          onClick={handleShare}
          className="fixed bottom-20 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6"
          title="Partager l'application"
          aria-label="Partager l'application"
        >
          <Share2 className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
