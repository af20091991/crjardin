import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SproutSplash } from "@/components/SproutSplash";
import { CLIENT_APK_URL } from "@/lib/mobile-update";

/** Clé locale : le lien personnel du client est mémorisé sur son téléphone (aucun mot de passe). */
const STORAGE_KEY = "js-client-token";

export const Route = createFileRoute("/jardin-signature")({
  head: () => ({
    meta: [
      { title: "Jardin Signature" },
      { name: "theme-color", content: "#F9F7F2" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Jardin Signature" },
    ],
    links: [
      { rel: "manifest", href: "/jardin-signature.webmanifest" },
      { rel: "apple-touch-icon", href: "/js-apple-touch-icon.png" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  component: JardinSignatureEntry,
});

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Stockage indisponible : le lien reste utilisable pour cette session.
  }
}

/** Extrait le jeton d'un lien personnel (« …/partage/JETON » ou « …?t=JETON »). */
function tokenFromLink(raw: string): string | null {
  const value = raw.trim();
  const m =
    value.match(/\/partage\/([A-Za-z0-9_-]{8,})/) ?? value.match(/[?&]t=([A-Za-z0-9_-]{8,})/);
  return m ? m[1] : null;
}

function JardinSignatureEntry() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    const found = t ?? readStoredToken();
    if (t) storeToken(t);
    setToken(found);
    setChecked(true);
  }, [t]);

  // Lien personnel connu : redirection immédiate, l'animation est jouée par l'espace client.
  useEffect(() => {
    if (token) {
      void navigate({
        to: "/partage/$token",
        params: { token },
        search: { intervention: undefined, section: undefined },
      });
    }
  }, [token, navigate]);

  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState(false);
  const usePastedLink = () => {
    const found = tokenFromLink(pasted);
    if (!found) {
      setPasteError(true);
      return;
    }
    storeToken(found);
    setPasteError(false);
    setToken(found);
  };

  if (!checked || token) return null;

  return (
    <>
      {!token && !splashDone && <SproutSplash onDone={onSplashDone} />}
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
        <div className="space-y-2 text-center">
          <p className="font-serif text-3xl font-semibold text-primary">Jardin Signature</p>
          <p className="text-sm text-muted-foreground">
            Votre espace jardin personnel : interventions, photos, documents et calendrier.
          </p>
        </div>

        {!token && (
          <section className="space-y-3 rounded-2xl border bg-card p-5 text-sm leading-6">
            <p className="font-medium">Accéder à votre espace</p>
            <p>
              Touchez le lien personnel envoyé par votre jardinier (SMS ou e-mail) : l'application
              s'ouvre directement. Vous pouvez aussi coller ce lien ci-dessous.
            </p>
            <div className="flex gap-2">
              <Input
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setPasteError(false);
                }}
                placeholder="Coller mon lien personnel"
                aria-label="Lien personnel"
                inputMode="url"
                autoCapitalize="none"
              />
              <Button onClick={usePastedLink} disabled={!pasted.trim()}>
                Ouvrir
              </Button>
            </div>
            {pasteError && (
              <p className="text-destructive">
                Ce lien n'est pas reconnu. Vérifiez qu'il est complet.
              </p>
            )}
          </section>
        )}

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <Smartphone className="h-4 w-4" />
            Sur Android
          </p>
          <p className="text-sm text-muted-foreground">
            Téléchargez l'application Jardin Signature pour y accéder en un geste.
          </p>
          <Button asChild className="w-full">
            <a href={CLIENT_APK_URL} rel="noopener noreferrer">
              <Download className="mr-1.5 h-4 w-4" />
              Télécharger l'application Android
            </a>
          </Button>
        </section>

        <section className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Sur iPhone ou ordinateur</p>
          <p>
            Ajoutez cette page à votre écran d'accueil depuis le menu de votre navigateur (partager,
            puis « Sur l'écran d'accueil »).
          </p>
        </section>
      </main>
    </>
  );
}
