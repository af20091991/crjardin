import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  biometricUnlock,
  haptic,
  isBiometricEnabled,
  isNativeApp,
  isStandalonePwa,
  nativePlugin,
} from "@/lib/native-app";

const RELOCK_AFTER_MS = 60_000;
const PULL_THRESHOLD = 90;

/** Fonctions « appli » v2 : raccourcis (liens profonds), retour haptique, mode hors-ligne,
 *  tirer pour actualiser et verrouillage biométrique. Inactif sur navigateur de bureau. */
export function NativeAppLayer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const native = isNativeApp();
  const appLike = native || isStandalonePwa();
  const [offline, setOffline] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // Raccourcis d'icône : pilotpro://open/<chemin>
  useEffect(() => {
    if (!native) return;
    const app = nativePlugin("App");
    if (!app) return;
    const go = (url?: string) => {
      if (!url) return;
      try {
        const u = new URL(url);
        if (u.protocol !== "pilotpro:" || u.hostname !== "open") return;
        if (/^\/[a-z0-9/_.$-]*$/i.test(u.pathname)) void navigate({ to: u.pathname as never });
      } catch {
        /* lien invalide */
      }
    };
    void app.getLaunchUrl?.().then((r: { url?: string } | undefined) => go(r?.url));
    const handle = app.addListener?.("appUrlOpen", (e: { url?: string }) => go(e.url));
    return () => {
      void handle?.then?.((h: { remove?: () => void }) => h.remove?.());
    };
  }, [native, navigate]);

  // Retour haptique sur la barre du bas
  useEffect(() => {
    if (!native) return;
    const onClick = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-bottom-nav] a, [data-bottom-nav] button")) haptic("LIGHT");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [native]);

  // Premier lancement : relit les données dès que la session est prête, et au retour au premier plan
  useEffect(() => {
    if (!appLike) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void queryClient.invalidateQueries();
      }
    });
    let hiddenSince: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenSince = Date.now();
      else if (hiddenSince && Date.now() - hiddenSince > 20_000) {
        hiddenSince = null;
        void queryClient.invalidateQueries();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [appLike, queryClient]);

  // Hors-ligne
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Tirer pour actualiser (appli installée uniquement : le navigateur gère déjà ce geste)
  useEffect(() => {
    if (!appLike) return;
    let startY: number | null = null;
    const onStart = (e: TouchEvent) => {
      startY = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.changedTouches[0].clientY - startY;
      startY = null;
      if (dy > PULL_THRESHOLD && window.scrollY <= 0) {
        haptic("MEDIUM");
        toast.message("Actualisation…");
        void queryClient.invalidateQueries();
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [appLike, queryClient]);

  // Verrouillage biométrique (option activée dans Personnalisation)
  const unlock = async () => {
    if (await biometricUnlock()) setLocked(false);
  };
  useEffect(() => {
    if (!native || !isBiometricEnabled()) return;
    setLocked(true);
    void unlock();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (
        isBiometricEnabled() &&
        hiddenAt.current &&
        Date.now() - hiddenAt.current > RELOCK_AFTER_MS
      ) {
        setLocked(true);
        void unlock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  return (
    <>
      {offline && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-3 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] text-xs font-medium text-destructive-foreground"
        >
          <WifiOff className="h-3.5 w-3.5" />
          Hors connexion — les modifications ne seront pas enregistrées
        </div>
      )}
      {locked && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <Fingerprint className="h-14 w-14 text-primary" />
          <p className="font-serif text-xl font-semibold text-primary">PilotPro est verrouillé</p>
          <Button onClick={unlock}>Déverrouiller</Button>
        </div>
      )}
    </>
  );
}
