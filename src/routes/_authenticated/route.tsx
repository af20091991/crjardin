import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: approved } = await supabase.rpc("is_approved", { _user_id: data.user.id });
    if (!approved) throw redirect({ to: "/pending" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});