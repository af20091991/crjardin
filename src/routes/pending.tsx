import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Leaf, Loader2 } from "lucide-react";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Compte en attente — Jardin Pro" }] }),
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
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Leaf className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-semibold">Jardin Pro</h1>
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