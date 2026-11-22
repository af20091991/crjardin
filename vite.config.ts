import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { nitro } from "nitro/vite";

// Variables serveur (non préfixées VITE_) disponibles via process.env au build et à l'exécution.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "GOOGLE_MAPS_API_KEY"]) {
  if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key];
}

export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: "node-server" }),
    viteReact(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      selfDestroying: true,
      devOptions: { enabled: false },
      outDir: ".output/public",
      filename: "sw.js",
      manifest: {
        name: "De la graine au jardin — Suivi de chantier",
        short_name: "CR Pro",
        description: "Gestion des interventions et comptes-rendus paysagers.",
        theme_color: "#4c8a2f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" }],
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
            options: {
              cacheName: "asset-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
