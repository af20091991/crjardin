/* eslint-disable @typescript-eslint/no-explicit-any */
/** Pont vers les plugins natifs de l'appli mobile (Capacitor). Tout est optionnel :
 *  sur le web ou avec une ancienne version de l'APK, les fonctions ne font rien. */
interface CapacitorLike {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, any>;
}

export function getCapacitor(): CapacitorLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
}

export function isNativeApp(): boolean {
  const cap = getCapacitor();
  return !!cap?.isNativePlatform?.() || ["android", "ios"].includes(cap?.getPlatform?.() ?? "");
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function nativePlugin<T = any>(name: string): T | undefined {
  return getCapacitor()?.Plugins?.[name] as T | undefined;
}

export function haptic(style: "LIGHT" | "MEDIUM" = "LIGHT") {
  try {
    void nativePlugin("Haptics")?.impact?.({ style });
  } catch {
    /* plugin absent */
  }
}

export const BIOMETRIC_KEY = "pp-biometric-lock";

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBiometricEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(BIOMETRIC_KEY, "1");
    else localStorage.removeItem(BIOMETRIC_KEY);
  } catch {
    /* stockage indisponible */
  }
}

/** true si le téléphone propose une biométrie (empreinte / visage) ou un code d'appareil. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    const r = await nativePlugin("BiometricAuth")?.checkBiometry?.();
    return !!r?.isAvailable;
  } catch {
    return false;
  }
}

/** true = déverrouillé (ou impossible à demander : on ne bloque jamais l'utilisateur). */
export async function biometricUnlock(): Promise<boolean> {
  const plugin = nativePlugin("BiometricAuth");
  if (!plugin?.authenticate) return true;
  try {
    await plugin.authenticate({
      reason: "Déverrouiller PilotPro",
      cancelTitle: "Annuler",
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}
