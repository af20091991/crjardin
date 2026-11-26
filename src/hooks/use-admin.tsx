import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { apercuRoleOverride } from "@/lib/apercu";

export function useIsAdmin() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return data as boolean;
    },
  });
  // Aperçu « vue prestataire » : pas de droits administrateur affichés (le hook reste appelé à chaque rendu).
  if (apercuRoleOverride() === "prestataire") return { isAdmin: false, isLoading: false };
  return { isAdmin: !!data, isLoading };
}
