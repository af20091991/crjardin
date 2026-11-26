import { nativePlugin, isNativeApp, biometricAvailable } from "@/lib/native-app";

/**
 * Connexion par empreinte (appli mobile uniquement).
 * Les identifiants sont rangés dans le coffre sécurisé du téléphone (Keychain / Keystore),
 * et ne sont relus qu'après une vérification biométrique ou du code de l'appareil.
 * Rien n'est stocké en clair dans le navigateur, sauf un simple indicateur « activé ».
 */
const SERVER = "pilotpro-login";
const FLAG_KEY = "pp-biometric-login";

export function biometricLoginEnabled(): boolean {
  try {
    return isNativeApp() && localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Propose la connexion par empreinte : téléphone compatible et appli mobile. */
export async function canOfferBiometricLogin(): Promise<boolean> {
  return isNativeApp() && (await biometricAvailable());
}

/** Enregistre les identifiants après une connexion réussie, si l'utilisateur l'a accepté. */
export async function saveBiometricLogin(email: string, password: string): Promise<boolean> {
  const plugin = nativePlugin("BiometricAuth");
  if (!plugin?.setCredentials) return false;
  try {
    await plugin.setCredentials({ server: SERVER, username: email, password });
    localStorage.setItem(FLAG_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Relit les identifiants après vérification biométrique. null si annulé ou absent. */
export async function readBiometricLogin(): Promise<{ email: string; password: string } | null> {
  const plugin = nativePlugin("BiometricAuth");
  if (!plugin?.getCredentials) return null;
  try {
    const creds = await plugin.getCredentials({
      server: SERVER,
      reason: "Se connecter à PilotPro",
      cancelTitle: "Annuler",
      allowDeviceCredential: true,
    });
    if (!creds?.username || !creds?.password) return null;
    return { email: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

/** Supprime les identifiants enregistrés (désactivation ou mot de passe modifié). */
export async function forgetBiometricLogin(): Promise<void> {
  try {
    await nativePlugin("BiometricAuth")?.deleteCredentials?.({ server: SERVER });
  } catch {
    /* absent : rien à supprimer */
  }
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch {
    /* stockage indisponible */
  }
}
