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
  /** Identifiant de l'appli installée (gestion ou client). */
  appId?: string;
}

export const UPDATE_CLICKED_KEY = "pp-update-clicked";

/** Identifiant de l'appli client « Jardin Signature » (distinct de la gestion PP). */
export const CLIENT_APP_ID = "fr.delagraineaujardin.jardinsignature";
/** APK de l'appli client : release « client-latest », mise à jour à chaque build. */
export const CLIENT_APK_URL =
  "https://github.com/af20091991/crjardin/releases/download/client-latest/JardinSignature.apk";

/** Vérifie si une nouvelle version de l'APK existe. Ne lève jamais d'exception. */
export async function checkMobileUpdate(): Promise<UpdateCheck> {
  const platform = getCapacitor()?.getPlatform?.() ?? "web";
  const result: UpdateCheck = { platform, installed: 0, outdated: false };
  if (platform !== "android") return result;

  try {
    const info = await nativePlugin<{ getInfo?: () => Promise<{ build?: string; id?: string }> }>(
      "App",
    )?.getInfo?.();
    result.installed = Number(info?.build ?? 0) || 0;
    result.appId = info?.id;
  } catch (e) {
    result.error = `Version installée illisible (${e instanceof Error ? e.message : String(e)})`;
  }

  try {
    const res = await fetch(`/mobile-version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result.remote = (await res.json()) as RemoteVersion;
    // L'appli client se met à jour depuis son propre APK, avec le même numéro de build.
    if (result.appId === CLIENT_APP_ID) result.remote.apkUrl = CLIENT_APK_URL;
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
