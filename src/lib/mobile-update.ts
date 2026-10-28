import { getCapacitor, nativePlugin } from "@/lib/native-app";

export interface RemoteVersion {
  latestBuild: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
}

export interface UpdateCheck {
  platform: string;
  /** Build installé, 0 si illisible. */
  installed: number;
  remote?: RemoteVersion;
  /** Détail de l'échec éventuel (affiché dans Personnalisation). */
  error?: string;
  /** true si une version plus récente existe (ou si la version installée est illisible). */
  outdated: boolean;
}

export const UPDATE_CLICKED_KEY = "pp-update-clicked";

/** Vérifie si une nouvelle version de l'APK existe. Ne lève jamais d'exception. */
export async function checkMobileUpdate(): Promise<UpdateCheck> {
  const platform = getCapacitor()?.getPlatform?.() ?? "web";
  const result: UpdateCheck = { platform, installed: 0, outdated: false };
  if (platform !== "android") return result;

  try {
    const info = await nativePlugin<{ getInfo?: () => Promise<{ build?: string }> }>(
      "App",
    )?.getInfo?.();
    result.installed = Number(info?.build ?? 0) || 0;
  } catch (e) {
    result.error = `Version installée illisible (${e instanceof Error ? e.message : String(e)})`;
  }

  try {
    const res = await fetch(`/mobile-version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result.remote = (await res.json()) as RemoteVersion;
  } catch (e) {
    result.error = `Fichier de version introuvable (${e instanceof Error ? e.message : String(e)})`;
    return result;
  }

  if (result.installed > 0) {
    result.outdated = result.remote.latestBuild > result.installed;
  } else {
    // Version installée illisible (ancien APK) : on invite quand même, une seule fois par version.
    let clicked = "";
    try {
      clicked = localStorage.getItem(UPDATE_CLICKED_KEY) ?? "";
    } catch {
      /* ignore */
    }
    result.outdated = clicked !== String(result.remote.latestBuild);
  }
  return result;
}
