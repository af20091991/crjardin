// Charte graphique unique Pilot Pro.
// Vert = principal, Bleu = ventes/positif, Rouge = charges/alertes,
// Orange = intermédiaire, Marron = métier, Jaune = avertissement, Gris = secondaire.
export const PP_COLORS = {
  primary: "var(--primary)",
  sales: "var(--pp-sales)",
  charges: "var(--pp-charges)",
  mid: "var(--pp-mid)",
  business: "var(--pp-business)",
  warning: "var(--pp-warning)",
  neutral: "var(--pp-neutral)",
  planned: "var(--pp-planned)",
  special: "var(--pp-special)",
} as const;

/** Palette de séries pour camemberts / histogrammes multi-catégories. */
export const PP_SERIES = [
  PP_COLORS.primary,
  PP_COLORS.sales,
  PP_COLORS.mid,
  PP_COLORS.business,
  PP_COLORS.warning,
  PP_COLORS.neutral,
  PP_COLORS.special,
];

export type SaleStatus = "planifie" | "realise" | "regle" | "particulier";

export const SALE_STATUS: Record<
  SaleStatus,
  { label: string; dot: string; row: string; badge: string }
> = {
  planifie: {
    label: "Planifié",
    dot: "bg-[var(--pp-planned)]",
    row: "bg-[color-mix(in_oklab,var(--pp-planned)_28%,transparent)]",
    badge: "bg-[color-mix(in_oklab,var(--pp-planned)_45%,transparent)] text-foreground",
  },
  realise: {
    label: "Réalisé / facturé",
    dot: "bg-[var(--pp-mid)]",
    row: "bg-[color-mix(in_oklab,var(--pp-mid)_16%,transparent)]",
    badge: "bg-[color-mix(in_oklab,var(--pp-mid)_28%,transparent)] text-foreground",
  },
  regle: {
    label: "Réglé",
    dot: "bg-[var(--primary)]",
    row: "bg-[color-mix(in_oklab,var(--primary)_14%,transparent)]",
    badge: "bg-[color-mix(in_oklab,var(--primary)_25%,transparent)] text-foreground",
  },
  particulier: {
    label: "Cas particulier",
    dot: "bg-[var(--pp-special)]",
    row: "bg-[color-mix(in_oklab,var(--pp-special)_16%,transparent)]",
    badge: "bg-[color-mix(in_oklab,var(--pp-special)_28%,transparent)] text-foreground",
  },
};

export const SALE_STATUS_ORDER: SaleStatus[] = ["planifie", "realise", "regle", "particulier"];
