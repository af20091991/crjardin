import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SproutSplash } from "@/components/SproutSplash";
import { CLIENT_APK_URL } from "@/lib/mobile-update";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Route } from "@/routes/jardin-signature";

/** Clé locale : le lien personnel du client est mémorisé sur son téléphone (aucun mot de passe). */
const STORAGE_KEY = "js-client-token";

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

interface PremiumOption {
  client_id: string;
  name: string;
}

/** Accès gérant : connexion PP ordinaire, réservée aux comptes administrateur. */
function GerantAccess() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<PremiumOption[]>([]);
  const [busy, setBusy] = useState(false);

  const loadGerant = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const admin = (roles ?? []).some((r) => r.role === "admin");
    setIsAdmin(admin);
    if (!admin) return;
    const { data } = await supabase
      .from("client_premium")
      .select("client_id, clients(name)")
      .eq("enabled", true);
    setClients(
      (data ?? [])
        .map((row) => ({
          client_id: row.client_id,
          name: (row.clients as unknown as { name: string } | null)?.name ?? "Client",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    );
  }, []);

  useEffect(() => {
    void loadGerant();
  }, [loadGerant]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signError) {
      setError("Connexion impossible. Vérifiez vos identifiants.");
      return;
    }
    setPassword("");
    await loadGerant();
  };

  if (isAdmin) {
    return (
      <section className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
        <p className="font-medium">Espace gérant</p>
        {clients.length === 0 && (
          <p className="text-muted-foreground">Aucun client Premium actif.</p>
        )}
        <ul className="space-y-2">
          {clients.map((c) => (
            <li key={c.client_id}>
              <a
                className="text-primary underline underline-offset-4"
                href={`/clients/premium-dashboard/${c.client_id}`}
              >
                {c.name}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => void supabase.auth.signOut().then(() => setIsAdmin(false))}
        >
          Se déconnecter
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3 text-center text-xs text-muted-foreground">
      {!open ? (
        <button type="button" className="underline" onClick={() => setOpen(true)}>
          Accès gérant
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl border bg-card p-5 text-left text-sm">
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button
            className="w-full"
            onClick={() => void signIn()}
            disabled={busy || !email || !password}
          >
            Se connecter
          </Button>
          {error && <p className="text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
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

        <GerantAccess />

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

export { JardinSignatureEntry };
export default JardinSignatureEntry;
