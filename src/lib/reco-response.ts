// État de réponse d'une préconisation, lisible sans ambiguïté par le jardinier.
// Source unique pour la fiche client et l'espace Premium (admin).
export type RecoResponseState = {
  label: string;
  tone: "accepted" | "refused" | "viewed" | "pending" | "neutral";
  detail?: string;
};

export function recoResponseState(reco: {
  status: string;
  client_interest: string | null;
  client_viewed_at?: string | null;
}): RecoResponseState {
  if (reco.client_interest === "interested") {
    return { label: "Client intéressé", tone: "accepted" };
  }
  if (reco.client_interest === "not_interested") {
    return { label: "Client pas intéressé", tone: "refused" };
  }
  if (reco.status === "refusee") {
    return { label: "Refusée", tone: "refused" };
  }
  if (["acceptee", "planifiee", "realisee", "facturee"].includes(reco.status)) {
    return { label: "Acceptée", tone: "accepted" };
  }
  if (reco.status === "en_attente") {
    return { label: "Pas encore proposée", tone: "neutral" };
  }
  if (reco.client_viewed_at) {
    return { label: "Consultée · pas de réponse du client", tone: "viewed" };
  }
  return { label: "Proposée · non consultée", tone: "pending" };
}

export const RECO_RESPONSE_TONE: Record<RecoResponseState["tone"], string> = {
  accepted: "text-emerald-700 dark:text-emerald-400",
  refused: "text-rose-700 dark:text-rose-400",
  viewed: "text-amber-700 dark:text-amber-400",
  pending: "text-muted-foreground",
  neutral: "text-muted-foreground",
};
