// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv } from "vite";

// Make server-only env vars available via process.env at runtime/build for email routes.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "LOVABLE_API_KEY"]) {
  if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key];
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        selfDestroying: true,
        devOptions: { enabled: false },
        // Let the active TanStack/Vite build pipeline own the client output directory.
        filename: "sw.js",
        manifest: {
          name: "De la graine au jardin — Suivi de chantier",
          short_name: "CR Pro",
          description: "Gestion des interventions et comptes-rendus paysagers.",
          theme_color: "#4c8a2f",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          icons: [
            { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/partage/],
          runtimeCaching: [
            {
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "html-cache", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/,
              handler: "CacheFirst",
              options: { cacheName: "asset-cache", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
            },
          ],
        },
      }),
    ],
  },
});
