import { useSuspenseQuery } from "@tanstack/react-query";
import { getSiteWebExternalSources } from "@/lib/site-web-sources.functions";

export function useSiteWebSources() {
  return useSuspenseQuery({
    queryKey: ["site-web-sources"],
    queryFn: () => getSiteWebExternalSources(),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
