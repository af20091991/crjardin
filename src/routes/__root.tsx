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

const SPLASH_CSS = `
#pp-splash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 42%,#fffdf8 0%,#F9F7F2 58%,#F1ECDF 100%);overflow:hidden;transition:opacity .6s ease,visibility .6s;font-family:Fraunces,Georgia,serif}
#pp-splash.pp-out{opacity:0;visibility:hidden;pointer-events:none}
#pp-splash .pp-stage{position:relative;width:min(80vmin,440px);height:min(80vmin,440px)}
#pp-splash .pp-ring{position:absolute;left:-4%;top:-4%;width:108%;height:108%;overflow:visible}
#pp-splash .pp-ring circle{fill:none;stroke:#7a4a2a;stroke-opacity:.45;stroke-width:.6;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;animation:pp-draw 2.2s cubic-bezier(.6,0,.3,1) .2s forwards}
#pp-splash .pp-logo{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;opacity:0;transform:scale(.5) rotate(-10deg);animation:pp-grow 1.4s cubic-bezier(.2,.9,.25,1.25) .3s forwards,pp-breathe 4.5s ease-in-out 1.9s infinite}
#pp-splash .pp-seed{position:absolute;bottom:4%;width:9px;height:9px;border-radius:50% 0 50% 0;opacity:0;animation:pp-float 4.8s ease-in infinite}
#pp-splash .pp-name{margin:1.4rem 0 0;font-size:1.95rem;font-weight:700;color:#4F8E33;letter-spacing:.02em;opacity:0;transform:translateY(10px);animation:pp-rise .9s ease 1.1s forwards}
#pp-splash .pp-tag{margin:.35rem 0 0;font-size:.8rem;color:#6b7564;letter-spacing:.2em;text-transform:uppercase;opacity:0;transform:translateY(10px);animation:pp-rise .9s ease 1.4s forwards}
#pp-splash .pp-bar{margin-top:2rem;width:min(56vw,240px);height:3px;border-radius:3px;background:#e3e8dc;overflow:hidden}
#pp-splash .pp-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4F8E33,#EE8627);animation:pp-fill 2.4s ease-in-out .3s forwards}
@keyframes pp-draw{to{stroke-dashoffset:0}}
@keyframes pp-grow{to{opacity:1;transform:scale(1) rotate(0)}}
@keyframes pp-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
@keyframes pp-rise{to{opacity:1;transform:none}}
@keyframes pp-fill{to{width:100%}}
@keyframes pp-float{0%{transform:translateY(0) translateX(0) scale(.6);opacity:0}12%{opacity:.85}100%{transform:translateY(-60vh) translateX(var(--dx,0)) scale(1.1);opacity:0}}
@media (prefers-reduced-motion:reduce){#pp-splash *{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
`;

const SPLASH_SEEDS: Array<{
  left: string;
  color: string;
  delay: string;
  dx: string;
  size: string;
}> = [
  { left: "18%", color: "#4F8E33", delay: "1.6s", dx: "-12px", size: "8px" },
  { left: "30%", color: "#EE8627", delay: "2.1s", dx: "10px", size: "7px" },
  { left: "44%", color: "#E3C94A", delay: "1.9s", dx: "-6px", size: "10px" },
  { left: "58%", color: "#4F8E33", delay: "2.5s", dx: "14px", size: "7px" },
  { left: "70%", color: "#EE8627", delay: "2.2s", dx: "-10px", size: "9px" },
  { left: "82%", color: "#8B5E3C", delay: "2.8s", dx: "8px", size: "8px" },
];

/** Écran de démarrage web : s'affiche dès le premier rendu, puis disparaît quand l'appli est prête. */
function SplashOverlay() {
  return (
    <>
      <div id="pp-splash" aria-hidden="true">
        <div className="pp-stage">
          <svg className="pp-ring" viewBox="0 0 100 100">
            <circle pathLength={100} cx="50" cy="50" r="47" />
          </svg>
          {SPLASH_SEEDS.map((seed, i) => (
            <span
              key={i}
              className="pp-seed"
              style={{
                left: seed.left,
                width: seed.size,
                height: seed.size,
                background: seed.color,
                animationDelay: seed.delay,
                ["--dx" as string]: seed.dx,
              }}
            />
          ))}
          <img className="pp-logo" src="/pp-logo.png" alt="" />
        </div>
        <p className="pp-name">PilotPro</p>
        <p className="pp-tag">De la graine au jardin</p>
        <div className="pp-bar">
          <i />
        </div>
      </div>
      {/* Filet de sécurité : si l'appli ne démarre pas, l'écran disparaît tout de même. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "setTimeout(function(){var e=document.getElementById('pp-splash');if(e)e.remove();},9000);",
        }}
      />
    </>
  );
}

/** Masque l'écran de démarrage après l'animation (2,4 s minimum), une fois l'appli affichée. */
function hideSplash() {
  const el = document.getElementById("pp-splash");
  if (!el) return;
  const t0 = performance.now();
  const wait = Math.max(0, 2400 - (performance.now() - t0));
  window.setTimeout(() => {
    el.classList.add("pp-out");
    window.setTimeout(() => el.remove(), 700);
  }, wait);
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      </head>
      <body>
        <SplashOverlay />
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
    hideSplash();
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
