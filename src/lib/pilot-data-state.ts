// Modèle typé commun des états de chargement du socle Pilot Pro.
// AUCUNE règle métier ici : uniquement la qualification d'une requête
// (chargement / disponible / vide / erreur / potentiellement périmé) et le
// message utilisateur associé. Ce module ne calcule aucun indicateur.

export type DataStatus = "loading" | "success" | "empty" | "error" | "stale";

export interface DataState {
  /** Identifiant technique stable de la ressource (clé React Query sérialisée). */
  id: string;
  /** Libellé français affiché à l'utilisateur. */
  label: string;
  status: DataStatus;
  /** Message utilisateur prêt à afficher. */
  message: string;
  /** Date de dernière actualisation réussie, si connue. */
  updatedAt: Date | null;
  /** Libellé de fraîcheur — « fraîcheur non disponible » si inconnue. */
  freshness: string;
  /** Vrai si la donnée ne doit pas être présentée comme fiable. */
  unreliable: boolean;
  /** Nouvelle tentative ciblée sur cette ressource uniquement. */
  retry: () => void;
}

/** Sous-ensemble de UseQueryResult nécessaire — pas de dépendance directe. */
export interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  dataUpdatedAt: number;
  isStale: boolean;
  refetch: () => unknown;
}

export function formatFreshness(updatedAt: Date | null): string {
  if (!updatedAt) return "fraîcheur non disponible";
  return `actualisé à ${updatedAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "erreur inconnue";
}

/**
 * Qualifie une requête. `isEmpty` permet de distinguer « aucune donnée » d'un
 * résultat valide : un 0 numérique réel n'est JAMAIS considéré comme vide ni
 * comme une erreur.
 */
export function resourceState<T>(
  id: string,
  label: string,
  query: QueryLike<T>,
  isEmpty: (data: T) => boolean = defaultIsEmpty,
): DataState {
  const updatedAt = query.dataUpdatedAt > 0 ? new Date(query.dataUpdatedAt) : null;
  const freshness = formatFreshness(updatedAt);
  const retry = () => {
    void query.refetch();
  };
  const base = { id, label, updatedAt, freshness, retry };

  if (query.isError) {
    return {
      ...base,
      status: "error",
      message: `${label} : erreur de chargement (${errorMessage(query.error)}).`,
      unreliable: true,
    };
  }
  if (query.isPending || query.data === undefined) {
    return {
      ...base,
      status: "loading",
      message: `${label} : chargement en cours…`,
      unreliable: true,
    };
  }
  if (isEmpty(query.data)) {
    return { ...base, status: "empty", message: `${label} : aucune donnée.`, unreliable: false };
  }
  if (query.isStale && !query.isFetching) {
    return {
      ...base,
      status: "stale",
      message: `${label} : données potentiellement périmées (${freshness}).`,
      unreliable: false,
    };
  }
  return { ...base, status: "success", message: `${label} : données disponibles.`, unreliable: false };
}

function defaultIsEmpty(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data === null) return true;
  if (data instanceof Map || data instanceof Set) return data.size === 0;
  return false;
}

const SEVERITY: Record<DataStatus, number> = {
  error: 4,
  loading: 3,
  stale: 2,
  empty: 1,
  success: 0,
};

/** État le plus dégradé d'un ensemble de ressources. */
export function worstStatus(states: DataState[]): DataStatus {
  return states.reduce<DataStatus>(
    (worst, s) => (SEVERITY[s.status] > SEVERITY[worst] ? s.status : worst),
    "success",
  );
}

export const STATUS_LABEL: Record<DataStatus, string> = {
  loading: "Chargement en cours",
  success: "Données disponibles",
  empty: "Aucune donnée",
  error: "Erreur de chargement",
  stale: "Données potentiellement périmées",
};

/**
 * Valeur d'affichage sûre : si la ressource nécessaire est indisponible,
 * renvoie un libellé explicite plutôt qu'un 0 trompeur. Un 0 réel est rendu
 * normalement par `render`.
 */
export function safeValue(
  states: DataState[],
  render: () => string,
): { value: string; unreliable: boolean } {
  const failing = states.find((s) => s.status === "error");
  if (failing) return { value: "Indisponible", unreliable: true };
  const loading = states.find((s) => s.status === "loading");
  if (loading) return { value: "Chargement…", unreliable: true };
  return { value: render(), unreliable: false };
}