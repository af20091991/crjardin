import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Réseau pas encore prêt (démarrage de l'appli mobile) : on réessaie avant de conclure. */
async function getUserWithRetry() {
  let last = await supabase.auth.getUser();
  for (let i = 0; i < 3 && last.error && !last.data.user; i++) {
    // 401/403 = session réellement invalide : inutile de réessayer.
    if (last.error.status === 401 || last.error.status === 403) break;
    await wait(600 * (i + 1));
    last = await supabase.auth.getUser();
  }
  return last;
}

async function isApprovedWithRetry(userId: string): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabase.rpc("is_approved", { _user_id: userId });
    if (!error) return !!data;
    await wait(600 * (i + 1));
  }
  // Erreur persistante (réseau) : on n'envoie pas à tort vers « en attente ».
  throw new Error("Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.");
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await getUserWithRetry();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (!(await isApprovedWithRetry(data.user.id))) throw redirect({ to: "/pending" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
