import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

export const getRouter = () => {
  // networkMode "always" : sur mobile, navigator.onLine peut être faux au démarrage de l'appli et
  // mettre toutes les requêtes en pause tant qu'elle n'est pas rouverte.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always",
        retry: 2,
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
        refetchOnReconnect: "always",
      },
      mutations: { networkMode: "always" },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} />,
  });

  return router;
};
