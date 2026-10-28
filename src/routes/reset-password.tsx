import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/reset-password")({
  // La session de récupération vit dans le navigateur (lien reçu par e-mail).
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — De la graine au jardin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const MIN_LENGTH = 8;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setReady(true);
    });
    // Le lien a déjà pu être traité avant l'abonnement : on regarde la session en cours.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const timer = window.setTimeout(() => setExpired(true), 6000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      toast.error(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(
        /same|different/i.test(error.message)
          ? "Choisissez un mot de passe différent de l'ancien."
          : "Impossible de modifier le mot de passe. Demandez un nouveau lien.",
      );
      return;
    }
    toast.success("Mot de passe modifié. Vous êtes connecté.");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="De la graine au jardin" className="mb-3 h-24 w-24 object-contain" />
          <h1 className="font-serif text-2xl font-semibold text-primary">Nouveau mot de passe</h1>
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            {ready ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={MIN_LENGTH}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`Au moins ${MIN_LENGTH} caractères`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={MIN_LENGTH}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer le mot de passe
                </Button>
              </form>
            ) : expired ? (
              <div className="space-y-4 text-center text-sm">
                <p className="text-muted-foreground">
                  Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis la page de
                  connexion (« Mot de passe oublié ? »).
                </p>
                <Button asChild className="w-full">
                  <Link to="/auth">Retour à la connexion</Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Vérification du lien…
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
