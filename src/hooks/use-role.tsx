import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "prestataire" | "observateur";

/** Returns the current user's highest-privilege role and whether they can edit data. */
export function useRole() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = data ?? [];
  const isAdmin = roles.includes("admin");
  const isPrestataire = roles.includes("prestataire");
  const role: AppRole = isAdmin ? "admin" : isPrestataire ? "prestataire" : "observateur";
  return { role, isAdmin, canEdit: isAdmin || isPrestataire, isLoading };
}
