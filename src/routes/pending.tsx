import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Compte en attente — De la graine au jardin" }] }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    supabase
      .rpc("is_approved", { _user_id: user.id })
      .then(({ data }) => {
        if (data) navigate({ to: "/", replace: true });
        else setChecking(false);
      });
  }, [user, loading, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex flex-col items-center">
          <img src={logo} alt="De la graine au jardin" className="mb-2 h-24 w-24 object-contain" />
          <h1 className="font-serif text-2xl font-semibold text-primary">De la graine au jardin</h1>
          <p className="mt-1 text-xs font-medium text-accent">au rythme de la nature</p>
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
              <Clock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">Compte en attente de validation</h2>
            <p className="text-sm text-muted-foreground">
              Votre inscription a bien été enregistrée. Un administrateur doit valider votre accès
              avant que vous puissiez utiliser l'application. Vous serez notifié dès l'activation.
            </p>
            <Button variant="outline" className="mt-2" onClick={signOut}>
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}