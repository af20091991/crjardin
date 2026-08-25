import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function describe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  if (error == null) return "Erreur inconnue (aucune donnée d'erreur remontée).";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Frontière d'erreur globale du routeur : au lieu d'un écran blanc, on affiche
 * l'erreur réelle et on la remonte à la télémétrie Lovable.
 */
export function RouteErrorBoundary({ error, reset }: { error: unknown; reset?: () => void }) {
  const message = describe(error);

  useEffect(() => {
    reportLovableError(error ?? new Error("Route error boundary caught undefined"), {
      boundary: "router_default",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La page n'a pas pu s'afficher. Vous pouvez réessayer ; si le problème persiste,
          copiez le message ci-dessous et transmettez-le.
        </p>
        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
          {message}
        </pre>
        <div className="mt-5 flex gap-2">
          <Button
            onClick={() => {
              if (reset) reset();
              else window.location.reload();
            }}
          >
            Réessayer
          </Button>
          <Button variant="outline" onClick={() => window.location.assign("/pilot")}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  );
}
