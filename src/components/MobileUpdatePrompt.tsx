import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { checkMobileUpdate, UPDATE_CLICKED_KEY, type RemoteVersion } from "@/lib/mobile-update";
import { nativePlugin } from "@/lib/native-app";

const DISMISS_KEY = "pp-mobile-update-dismissed";

type ApkUpdateNative = {
  downloadAndInstall: (o: { url: string }) => Promise<{ needsPermission?: boolean }>;
  openInstallSettings: () => Promise<void>;
};

/**
 * Mise à jour en un clic : téléchargement et installation dans l'appli (module natif ApkUpdate).
 * Ancienne version de l'APK sans ce module : ouverture du lien de téléchargement.
 */
export async function openUpdate(remote: RemoteVersion): Promise<void> {
  try {
    localStorage.setItem(UPDATE_CLICKED_KEY, String(remote.latestBuild));
  } catch {
    /* ignore */
  }
  const plugin = nativePlugin<ApkUpdateNative>("ApkUpdate");
  if (!plugin?.downloadAndInstall) {
    window.open(remote.apkUrl, "_blank");
    return;
  }
  try {
    const result = await plugin.downloadAndInstall({ url: remote.apkUrl });
    if (result?.needsPermission) {
      toast.info(
        "Autorisez l'installation pour PilotPro, puis appuyez de nouveau sur Mettre à jour.",
      );
      await plugin.openInstallSettings();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Ancienne APK sans le module natif : on passe par le téléchargement classique.
    if (/not implemented|not found/i.test(message)) {
      window.open(remote.apkUrl, "_blank");
      return;
    }
    toast.error(message);
  }
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
