import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkMobileUpdate, UPDATE_CLICKED_KEY, type RemoteVersion } from "@/lib/mobile-update";

const DISMISS_KEY = "pp-mobile-update-dismissed";

export function openUpdate(remote: RemoteVersion) {
  try {
    localStorage.setItem(UPDATE_CLICKED_KEY, String(remote.latestBuild));
  } catch {
    /* ignore */
  }
  window.open(remote.apkUrl, "_blank");
}

/**
 * Appli mobile Android uniquement : informe qu'une nouvelle version de l'APK existe.
 * Non bloquant — l'utilisateur peut continuer ; ses données sont dans PP, pas dans l'APK.
 */
export function MobileUpdatePrompt() {
  const [update, setUpdate] = useState<RemoteVersion | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkMobileUpdate().then((r) => {
      if (cancelled || !r.outdated || !r.remote) return;
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === String(r.remote.latestBuild)) return;
      } catch {
        /* stockage indisponible : on affiche */
      }
      setUpdate(r.remote);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(update.latestBuild));
    } catch {
      /* ignore */
    }
    setUpdate(null);
  };

  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm md:hidden"
    >
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium text-foreground">
          Nouvelle version de l'application ({update.versionName})
        </p>
        <p className="text-xs text-muted-foreground">
          {update.notes ?? "Une mise à jour est disponible."} Vous pouvez continuer à l'utiliser :
          vos données sont conservées.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openUpdate(update)}>
            Mettre à jour
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Plus tard
          </Button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Fermer" className="text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
