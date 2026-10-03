import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  setRecommendationInterest,
  trackPremiumRecommendationsConsulted,
  type PremiumRecommendationGroup,
  type SharedRecommendation,
} from "@/lib/share.functions";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Interest = "interested" | "not_interested" | "none";

function RecommendationRow({ reco, token }: { reco: SharedRecommendation; token: string }) {
  const qc = useQueryClient();
  const choose = useMutation({
    mutationFn: (interest: Interest) =>
      setRecommendationInterest({ data: { token, recoId: reco.id, interest } }),
    onSuccess: (_, interest) => {
      toast.success(
        interest === "none" ? "Votre choix a été retiré." : "Merci, votre jardinier est prévenu.",
      );
      qc.invalidateQueries({ queryKey: ["shared-premium", token] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer votre choix."),
  });

  const answered =
    reco.client_interest === "interested" || reco.client_interest === "not_interested";
  const interested = reco.client_interest === "interested";

  return (
    <li className="grid gap-4 border-b py-6 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <h3 className="font-premium-serif text-xl font-medium leading-tight sm:text-2xl">
          {reco.title}
        </h3>
        {reco.description && (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {reco.description}
          </p>
        )}
      </div>
      <div
        className="flex flex-wrap items-center gap-2 sm:justify-end"
        role="group"
        aria-label="Votre choix"
      >
        <button
          type="button"
          disabled={choose.isPending}
          aria-pressed={interested}
          onClick={() => choose.mutate(interested ? "none" : "interested")}
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            interested
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary hover:text-primary"
          }`}
        >
          <Check className="size-4" />
          Intéressé
        </button>
        <button
          type="button"
          disabled={choose.isPending}
          aria-pressed={answered && !interested}
          onClick={() => choose.mutate(answered && !interested ? "none" : "not_interested")}
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            answered && !interested
              ? "border-foreground/70 bg-foreground/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:border-foreground/50 hover:text-foreground"
          }`}
        >
          <X className="size-4" />
          Pas intéressé
        </button>
      </div>
    </li>
  );
}

export function PremiumRecommendations({
  groups,
  token,
}: {
  groups: PremiumRecommendationGroup[];
  token: string;
}) {
  // Suivi : le jardinier est prévenu dans Pilot Pro dès que ce panneau est consulté.
  useEffect(() => {
    void trackPremiumRecommendationsConsulted({ data: { token } }).catch(() => undefined);
  }, [token]);

  if (groups.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <Sparkles className="mx-auto size-8 text-primary/60" strokeWidth={1.4} />
        <p className="mt-3 font-premium-serif text-2xl">Vos préconisations</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Les conseils rédigés après chaque intervention apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-12">
      {groups.map((group) => (
        <section key={group.intervention_id ?? "autres"}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
            <h2 className="font-premium-serif text-2xl font-medium sm:text-3xl">{group.title}</h2>
            {formatDate(group.date) && (
              <p className="text-sm text-muted-foreground">{formatDate(group.date)}</p>
            )}
          </div>
          <ul>
            {group.items.map((reco) => (
              <RecommendationRow key={reco.id} reco={reco} token={token} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
