/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCapacitor, isNativeApp, nativePlugin } from "@/lib/native-app";

/** Chemin interne sûr à partir d'une donnée de notification (jamais d'URL externe). */
export function safePushPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\/[\w/_.$%~-]*$/.test(value) && !value.startsWith("//") ? value : null;
}

/** Enregistre le téléphone pour les notifications push et ouvre la bonne page au toucher.
 *  Sans effet sur le web ou si l'APK ne contient pas encore le module push. */
export function usePushRegistration() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isNativeApp()) return;
    const push = nativePlugin("PushNotifications");
    if (!push?.addListener) return;
    const platform = getCapacitor()?.getPlatform?.() ?? "android";
    const handles: Array<Promise<{ remove?: () => void }> | undefined> = [];
    let cancelled = false;

    const saveToken = async (token: string) => {
      await (supabase as any)
        .from("push_tokens")
        .upsert({ user_id: user.id, token, platform }, { onConflict: "token" });
    };

    void (async () => {
      try {
        handles.push(
          push.addListener("registration", (t: { value?: string }) => {
            if (t?.value && !cancelled) void saveToken(t.value);
          }),
        );
        handles.push(
          push.addListener(
            "pushNotificationActionPerformed",
            (e: { notification?: { data?: Record<string, unknown> } }) => {
              const path = safePushPath(e?.notification?.data?.url);
              if (path) void navigate({ to: path as never });
            },
          ),
        );
        let perm = await push.checkPermissions?.();
        if (perm?.receive === "prompt" || perm?.receive === "prompt-with-rationale") {
          perm = await push.requestPermissions?.();
        }
        if (perm?.receive === "granted") await push.register?.();
      } catch {
        /* module push absent de cette version de l'APK */
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => void h?.then?.((x) => x.remove?.()));
    };
  }, [user, navigate]);
}
