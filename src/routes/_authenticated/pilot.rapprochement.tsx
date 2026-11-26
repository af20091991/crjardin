import { createFileRoute, redirect } from "@tanstack/react-router";

// Regroupé dans le Centre de données.
export const Route = createFileRoute("/_authenticated/pilot/rapprochement")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: "lignes" | "doublons" | "regles" | "journal" } => ({
    section: ["lignes", "doublons", "regles", "journal"].includes(search.section as string)
      ? (search.section as "lignes" | "doublons" | "regles" | "journal")
      : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/pilot/donnees",
      search: {
        vue: "rapprochement",
        section: (search as { section?: "lignes" | "doublons" | "regles" | "journal" }).section,
      },
    });
  },
});
