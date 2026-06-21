import { useQuery } from "@tanstack/react-query";
import { getUserStats, type AppUser } from "@/lib/admin";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Users, FileText, Sparkles, Clock } from "lucide-react";

const ROLE_LABEL: Record<AppUser["role"], string> = {
  admin: "Administrateur",
  prestataire: "Prestataire",
  observateur: "Observateur",
};

export function UserDetailDialog({ user, trigger }: { user: AppUser; trigger: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.display_name ?? "Utilisateur"}</DialogTitle>
        </DialogHeader>
        <Body userId={user.id} user={user} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ userId, user }: { userId: string; user: AppUser }) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: () => getUserStats(userId),
  });

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{ROLE_LABEL[user.role]}</span>
        {user.company_name && <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{user.company_name}</span>}
        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
          Inscrit le {new Date(user.created_at).toLocaleDateString("fr-FR")}
        </span>
      </div>
      {isLoading ? (
        <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Users} label="Clients" value={data?.clients} />
          <Stat icon={FileText} label="Comptes-rendus" value={data?.interventions} />
          <Stat icon={Sparkles} label="Préconisations" value={data?.recommendations} />
          <Stat
            icon={Clock}
            label="Dernière connexion"
            value={data?.lastLogin ? new Date(data.lastLogin).toLocaleDateString("fr-FR") : "—"}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-lg border p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-1 text-lg font-semibold">{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
