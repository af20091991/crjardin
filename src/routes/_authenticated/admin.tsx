import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listUsersByStatus, setUserApproval, listLoginEvents, listAllUsers, listClientAccesses } from "@/lib/admin";
import { EmailTemplateEditor } from "@/components/EmailTemplateEditor";
import { deleteUserAccount } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Shield, Eye, MessageSquare, Users, FileText, UserCheck, Check, X, LogIn, UserCog, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — De la graine au jardin" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const [clients, interventions, messages, reads] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("interventions").select("id", { count: "exact", head: true }),
        supabase.from("client_messages").select("id", { count: "exact", head: true }),
        supabase.from("share_access_log").select("id", { count: "exact", head: true }),
      ]);
      return {
        clients: clients.count ?? 0,
        interventions: interventions.count ?? 0,
        messages: messages.count ?? 0,
        reads: reads.count ?? 0,
      };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-messages"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_messages")
        .select("id, kind, content, author_name, created_at, resolved, client_id")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: accesses } = useQuery({
    queryKey: ["admin-accesses"],
    enabled: isAdmin,
    queryFn: () => listClientAccesses(50),
  });

  const { data: allUsers } = useQuery({
    queryKey: ["admin-all-users"],
    enabled: isAdmin,
    queryFn: () => listAllUsers(),
  });

  const { data: pending } = useQuery({
    queryKey: ["admin-pending"],
    enabled: isAdmin,
    queryFn: () => listUsersByStatus("pending"),
  });

  const { data: logins } = useQuery({
    queryKey: ["admin-logins"],
    enabled: isAdmin,
    queryFn: () => listLoginEvents(30),
  });

  const approval = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => setUserApproval(id, status),
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Compte validé" : "Inscription refusée");
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  if (isLoading || !isAdmin) {
    return (
      <AppShell title="Administration">
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  const cards = [
    { label: "Clients", value: stats?.clients, icon: Users },
    { label: "Comptes-rendus", value: stats?.interventions, icon: FileText },
    { label: "Messages clients", value: stats?.messages, icon: MessageSquare },
    { label: "Consultations", value: stats?.reads, icon: Eye },
  ];

  return (
    <AppShell title="Administration">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-primary" />
          Supervision de l'ensemble de l'application
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex flex-col gap-1 pt-5">
                <c.icon className="h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{c.value ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <EmailTemplateEditor />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" /> Inscriptions à valider
              {(pending ?? []).length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                  {(pending ?? []).length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pending ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune inscription en attente.</p>
            ) : (
              (pending ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.display_name ?? "Sans nom"}</p>
                    <p className="text-xs text-muted-foreground">
                      Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" className="h-8" disabled={approval.isPending}
                      onClick={() => approval.mutate({ id: u.id, status: "approved" })}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Valider
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={approval.isPending}
                      onClick={() => approval.mutate({ id: u.id, status: "rejected" })}>
                      <X className="mr-1 h-3.5 w-3.5" /> Refuser
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-primary" /> Comptes utilisateurs
              {(allUsers ?? []).length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                  {(allUsers ?? []).length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(allUsers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun compte.</p>
            ) : (
              (allUsers ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.display_name ?? "Sans nom"}
                      {u.is_admin && (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Admin</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.company_name ? `${u.company_name} · ` : ""}Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
                    u.approval_status === "approved"
                      ? "bg-primary/10 text-primary"
                      : u.approval_status === "rejected"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {u.approval_status === "approved" ? "Validé" : u.approval_status === "rejected" ? "Refusé" : "En attente"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Derniers messages clients</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(messages ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun message.</p>
            ) : (
              (messages ?? []).map((m) => (
                <div key={m.id} className="flex items-start gap-2 border-b pb-2 text-sm last:border-0">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.kind === "question" ? "Question" : "Annotation"}{m.author_name ? ` · ${m.author_name}` : ""}</p>
                    <p className="text-muted-foreground">{m.content}</p>
                    <Link to="/clients/$clientId" params={{ clientId: m.client_id }} className="text-xs text-primary hover:underline">
                      Voir la fiche client
                    </Link>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-primary" /> Consultations clients (adresses IP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(accesses ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune consultation enregistrée.</p>
            ) : (
              (accesses ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                  <div className="min-w-0">
                    <Link to="/clients/$clientId" params={{ clientId: a.client_id }} className="flex items-center gap-2 font-medium text-primary hover:underline">
                      <Eye className="h-4 w-4 shrink-0" /> {a.client_name ?? "Fiche consultée"}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      IP : {a.ip_address ?? "inconnue"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(a.accessed_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogIn className="h-4 w-4 text-primary" /> Dernières connexions utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(logins ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune connexion enregistrée.</p>
            ) : (
              (logins ?? []).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.display_name ?? "Utilisateur"}</p>
                    {l.user_agent && <p className="truncate text-xs text-muted-foreground">{l.user_agent}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
