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
    <li className="grid gap-5 border-b py-6 last:border-b-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-start">
      <div
        className="order-2 flex flex-col gap-2 sm:order-1"
        role="group"
        aria-label="Votre décision"
      >
        <button
          type="button"
          disabled={choose.isPending}
          aria-pressed={interested}
          onClick={() => choose.mutate(interested ? "none" : "interested")}
          className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-5 py-3 text-base font-semibold transition-colors disabled:opacity-60 ${
            interested
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
              : "border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          <Check className="size-5" />
          Intéressé
        </button>
        <button
          type="button"
          disabled={choose.isPending}
          aria-pressed={answered && !interested}
          onClick={() => choose.mutate(answered && !interested ? "none" : "not_interested")}
          className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-5 py-3 text-base font-semibold transition-colors disabled:opacity-60 ${
            answered && !interested
              ? "border-red-600 bg-red-600 text-white shadow-sm"
              : "border-red-600 bg-red-50 text-red-800 hover:bg-red-600 hover:text-white dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          <X className="size-5" />
          Pas intéressé
        </button>
      </div>
      <div className="order-1 min-w-0 sm:order-2">
        <h3 className="font-premium-serif text-xl font-medium leading-tight sm:text-2xl">
          {reco.title}
        </h3>
        {reco.description && (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {reco.description}
          </p>
        )}
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
