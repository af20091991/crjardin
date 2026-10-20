import { supabase } from "@/integrations/supabase/client";

/**
 * Personnalisation enregistrée sur le compte (table user_preferences).
 * Le navigateur reste un cache : si la table est indisponible, les réglages locaux continuent
 * de fonctionner exactement comme avant (aucune perte).
 */
const SYNCED_PREFIXES = ["cr-sst-calendar-appearance", "pp.layout.", "pp.cardprefs."];

export const isSyncedKey = (key: string): boolean =>
  SYNCED_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));

interface PrefsTable {
  select: (columns: string) => PromiseLike<{
    data: Array<{ key: string; value: unknown }> | null;
    error: unknown;
  }>;
  upsert: (
    row: { user_id: string; key: string; value: unknown; updated_at: string },
    options: { onConflict: string },
  ) => PromiseLike<{ error: unknown }>;
  delete: () => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
}

const table = (): PrefsTable =>
  (supabase as unknown as { from: (name: string) => PrefsTable }).from("user_preferences");

let currentUserId: string | null = null;
export const setPrefsUser = (id: string | null) => {
  currentUserId = id;
};

/** Enregistre une préférence sur le compte (silencieux en cas d'échec). */
export function mirrorPrefToAccount(key: string, value: unknown): void {
  if (!currentUserId || !isSyncedKey(key)) return;
  void table()
    .upsert(
      { user_id: currentUserId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" },
    )
    .then(
      () => undefined,
      () => undefined,
    );
}

export function removePrefFromAccount(key: string): void {
  if (!currentUserId || !isSyncedKey(key)) return;
  void Promise.resolve(table().delete().eq("user_id", currentUserId).eq("key", key)).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Au démarrage : les préférences du compte remplacent le cache local ; celles qui n'existent
 * que sur cet appareil sont envoyées vers le compte (reprise de l'existant, rien n'est perdu).
 */
export async function hydrateAccountPrefs(userId: string): Promise<void> {
  setPrefsUser(userId);
  try {
    const { data, error } = await table().select("key,value");
    if (error || !data) return;
    const remote = new Set<string>();
    for (const row of data) {
      if (!isSyncedKey(row.key)) continue;
      remote.add(row.key);
      window.localStorage.setItem(row.key, JSON.stringify(row.value));
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !isSyncedKey(key) || remote.has(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        mirrorPrefToAccount(key, JSON.parse(raw));
      } catch {
        /* valeur locale illisible : ignorée */
      }
    }
  } catch {
    /* hors ligne ou table absente : le cache local reste la référence */
  }
}
