import { SpellcheckAssistant } from "@/components/SpellcheckAssistant";
import { SpellcheckGuard } from "@/components/SpellcheckGuard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import "../nav-group-colors.css";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { AppearanceProvider } from "@/lib/appearance";
import { PilotModeProvider } from "@/lib/pilot-mode";
import { Toaster } from "@/components/ui/sonner";
import { registerPwa } from "@/lib/pwa";
import { APP_VERSION } from "@/lib/app-meta";
import { hydrateAccountPrefs, setPrefsUser } from "@/lib/account-prefs";
import { useAuth } from "@/hooks/use-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: `De la graine au jardin v${APP_VERSION} — Paysagiste` },
      {
        name: "description",
        content:
          "Espace de suivi d'entretien paysager De la graine au jardin : comptes-rendus, préconisations et partage client, au rythme de la nature.",
      },
      { name: "author", content: "De la graine au jardin" },
      { property: "og:title", content: "De la graine au jardin — Paysagiste" },
      {
        property: "og:description",
        content: "Suivi d'entretien paysager et comptes-rendus clients, au rythme de la nature.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "De la graine au jardin — Paysagiste" },
      {
        name: "twitter:description",
        content: "Suivi d'entretien paysager et comptes-rendus clients, au rythme de la nature.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ae2d8fa-5fd4-4797-ab10-a001529d7362/id-preview-66a2adc9--3545adef-a337-4e33-aef9-684d626fa27c.lovable.app-1781453660626.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ae2d8fa-5fd4-4797-ab10-a001529d7362/id-preview-66a2adc9--3545adef-a337-4e33-aef9-684d626fa27c.lovable.app-1781453660626.png",
      },
      { name: "theme-color", content: "#4F8E33" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "PilotPro" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "preconnect",
        href: "https://mgkeqwwzhcodntkakqaz.supabase.co",
        crossOrigin: "anonymous",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    ],
    scripts: [
      {
        // Appli mobile : masque l'écran de lancement dès que la page est affichée.
        children:
          "(function(){function w(){try{if(document.documentElement.dataset.ppReady)return;if(sessionStorage.getItem('pp-boot-reload'))return;sessionStorage.setItem('pp-boot-reload','1');location.reload();}catch(e){}}setTimeout(w,9000);function h(){try{var p=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.SplashScreen;if(p)p.hide();}catch(e){}}if(document.readyState==='complete')h();else window.addEventListener('load',h);setTimeout(h,1500);})();",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Charge la personnalisation du compte avant d'afficher les pages (3 s maximum d'attente). */
function AccountPrefsGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPrefsUser(null);
      return;
    }
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReadyFor(userId);
    };
    const timer = window.setTimeout(done, 3000);
    void hydrateAccountPrefs(userId).finally(() => {
      window.clearTimeout(timer);
      done();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userId]);

  if (userId && readyFor !== userId) return null;
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerPwa();
    // Signale au garde-fou de démarrage que l'application s'est bien affichée.
    document.documentElement.dataset.ppReady = "1";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SpellcheckGuard />
      <SpellcheckAssistant />
      <AuthProvider>
        <AppearanceProvider>
          <PilotModeProvider>
            <AccountPrefsGate>
              <Outlet />
            </AccountPrefsGate>
          </PilotModeProvider>
          <Toaster
            richColors
            position="top-center"
            offset="calc(env(safe-area-inset-top) + 8px)"
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)", left: 12, right: 12 }}
          />
        </AppearanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
