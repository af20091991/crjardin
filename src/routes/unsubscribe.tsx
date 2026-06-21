import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, MailX } from "lucide-react";

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  head: () => ({ meta: [{ title: "Désinscription" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) setState("invalid");
        else if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {state === "done" || state === "already" ? <CheckCircle2 className="h-6 w-6" /> : <MailX className="h-6 w-6" />}
          </div>
          {state === "loading" && (
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
            </p>
          )}
          {state === "valid" && (
            <>
              <h1 className="font-serif text-xl font-semibold">Se désabonner des e-mails</h1>
              <p className="text-sm text-muted-foreground">
                Confirmez pour ne plus recevoir d'e-mails de notification de notre part.
              </p>
              <Button onClick={confirm} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer la désinscription
              </Button>
            </>
          )}
          {state === "done" && (
            <>
              <h1 className="font-serif text-xl font-semibold">Vous êtes désabonné(e)</h1>
              <p className="text-sm text-muted-foreground">Vous ne recevrez plus d'e-mails de notification.</p>
            </>
          )}
          {state === "already" && (
            <>
              <h1 className="font-serif text-xl font-semibold">Déjà désabonné(e)</h1>
              <p className="text-sm text-muted-foreground">Cette adresse est déjà désinscrite.</p>
            </>
          )}
          {(state === "invalid" || state === "error") && (
            <>
              <h1 className="font-serif text-xl font-semibold">Lien invalide</h1>
              <p className="text-sm text-muted-foreground">Ce lien de désinscription est invalide ou a expiré.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}