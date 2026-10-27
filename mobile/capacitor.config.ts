import type { CapacitorConfig } from "@capacitor/cli";

// URL de l'app PP publiée. Toute modification déployée sur PP est donc
// immédiatement visible dans l'app mobile (aucune republication nécessaire).
const url = process.env.PP_APP_URL ?? "https://crjardin.lovable.app";

const config: CapacitorConfig = {
  appId: "fr.delagraineaujardin.pp",
  appName: "CR Pro",
  webDir: "www",
  backgroundColor: "#F9F7F2",
  server: {
    url,
    cleartext: false,
    allowNavigation: ["*.supabase.co", "*.lovable.app", "accounts.google.com", "*.googleapis.com"],
  },
  ios: { contentInset: "always", scheme: "CR Pro" },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#F9F7F2", showSpinner: false },
    StatusBar: { style: "DARK", backgroundColor: "#F9F7F2", overlaysWebView: false },
    Keyboard: { resize: "body" },
  },
};

export default config;
