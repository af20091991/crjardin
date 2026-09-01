import { useSuspenseQuery } from "@tanstack/react-query";
import { getMergedSiteWebModel } from "@/lib/site-web-merged.functions";

/**
 * Hook to load merged Site web model (external + demo).
 * Always succeeds: returns demo if external sources fail.
 */
export function useMergedSiteWebModel() {
  return useSuspenseQuery({
    queryKey: ["site-web-merged-model"],
    queryFn: () => getMergedSiteWebModel(),
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}
