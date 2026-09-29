import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Crown,
  ExternalLink,
  FileText,
  MessageSquare,
  Search,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listClients, type Client } from "@/lib/clients";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { signedPremiumDocumentUrl } from "@/lib/client-premium";
import { sendPremiumWelcomeEmail } from "@/lib/premium-email.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/premium")({
  head: () => ({
    meta: [{ title: "Comptes Premium — De la graine au jardin" }],
  }),
  component: PremiumClientsPage,
});

type PremiumStatus = {
  client_id: string;
  enabled: boolean;
  activated_at: string | null;
  updated_at: string | null;
};

type PremiumMessage = {
  id: string;
  client_id: string;
  kind: string;
  content: string;
  author_name: string | null;
  sender: string;
  resolved: boolean;
  created_at: string;
};

type PremiumDocumentRow = {
  id: string;
  client_id: string;
  title: string;
  filename: string;
  storage_path: string;
  uploaded_by: "gardener" | "client";
  created_at: string;
  visible_to_client: boolean;
};

type PremiumAccess = {
  client_id: string;
  accessed_at: string;
};

type PremiumRecommendation = {
  id: string;
  client_id: string;
  title: string;
  client_interest: string | null;
  client_interest_at: string | null;
};

function displayClientName(client: Client) {
  const civility = client.civility?.trim().toLowerCase();
  if (
    civility === "madame et monsieur" ||
    civility === "monsieur et madame" ||
    civility === "mme et m." ||
    civility === "m. et mme"
  ) {
    return `Madame et Monsieur ${client.name}`;
  }
  if (civility === "madame" || civility === "mme" || civility === "mrs") {
    return `Madame ${client.name}`;
  }
  if (civility === "monsieur" || civility === "m." || civility === "mr") {
    return `Monsieur ${client.name}`;
  }
  return client.name;
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// prettier-ignore
// Regroupement des consultations Premium par client.
function PremiumClientsPage() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const sendPremiumEmail = useServerFn(sendPremiumWelcomeEmail);

  const premiumEmailMutation = useMutation({
    mutationFn: (clientId: string) => sendPremiumEmail({ data: { clientId } }),
    onSuccess: (result) => {
      toast.success(`E-mail envoyé à ${result.recipient}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d’envoyer l’e-mail Premium.");
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled: isAdmin,
  });

  const premiumQuery = useQuery({
    queryKey: ["client-premium-enabled"],
    enabled: isAdmin,
    queryFn: async (): Promise<PremiumStatus[]> => {
      const { data, error } = await supabase
        .from("client_premium")
        .select("client_id, enabled, activated_at, updated_at")
        .eq("enabled", true)
        .order("activated_at", { ascending: false });
      if (error) throw new Error(`Impossible de charger les comptes Premium : ${error.message}`);
      return (data ?? []) as PremiumStatus[];
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["premium-admin-messages"],
    enabled: isAdmin,
    queryFn: async (): Promise<PremiumMessage[]> => {
      const { data, error } = await supabase
        .from("client_messages")
        .select("id, client_id, kind, content, author_name, sender, resolved, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Impossible de charger les demandes Premium : ${error.message}`);
      return (data ?? []) as PremiumMessage[];
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["premium-admin-documents"],
    enabled: isAdmin,
    queryFn: async (): Promise<PremiumDocumentRow[]> => {
      const { data, error } = await supabase
        .from("client_premium_documents")
        .select(
          "id, client_id, title, filename, storage_path, uploaded_by, created_at, visible_to_client",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(`Impossible de charger les documents Premium : ${error.message}`);
      return (data ?? []) as PremiumDocumentRow[];
    },
  });

  const accessQuery = useQuery({
    queryKey: ["premium-admin-access"],
    enabled: isAdmin,
    queryFn: async (): Promise<PremiumAccess[]> => {
      const { data, error } = await supabase
        .from("share_access_log")
        .select("client_id, accessed_at")
        .order("accessed_at", { ascending: false })
        .limit(500);
      if (error) {
        throw new Error(`Impossible de charger les consultations Premium : ${error.message}`);
      }
      return (data ?? []) as PremiumAccess[];
    },
  });

  const recommendationsQuery = useQuery({
    queryKey: ["premium-admin-recommendations"],
    enabled: isAdmin,
    queryFn: async (): Promise<PremiumRecommendation[]> => {
      const { data, error } = await supabase
        .from("recommendations")
        .select("id, client_id, title, client_interest, client_interest_at")
        .not("client_interest", "is", null)
        .order("client_interest_at", { ascending: false })
        .limit(100);
      if (error) {
        throw new Error(`Impossible de charger les retours de préconisations : ${error.message}`);
      }
      return (data ?? []) as PremiumRecommendation[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("client_messages")
        .update({ resolved: true })
        .eq("id", messageId);
      if (error) throw new Error(`Impossible de traiter la demande : ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premium-admin-messages"] });
    },
    onError: (error) => {
      console.error(error);
    },
  });

  const clientsById = useMemo(
    () => new Map((clientsQuery.data ?? []).map((client) => [client.id, client])),
    [clientsQuery.data],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (premiumQuery.data ?? [])
      .map((premium) => ({
        premium,
        client: clientsById.get(premium.client_id),
      }))
      .filter((row): row is { premium: PremiumStatus; client: Client } => Boolean(row.client))
      .filter(({ client }) => client.contract_type === "Entretien annuel")
      .filter(({ client }) => {
        if (!query) return true;
        return [client.name, client.civility, client.address, client.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((a, b) => a.client.name.localeCompare(b.client.name, "fr"));
  }, [clientsById, premiumQuery.data, search]);

  const premiumIds = useMemo(() => new Set(rows.map(({ client }) => client.id)), [rows]);

  const pendingMessages = useMemo(
    () =>
      (messagesQuery.data ?? []).filter(
        (message) =>
          premiumIds.has(message.client_id) &&
          !message.resolved &&
          message.sender === "client",
      ),
    [messagesQuery.data, premiumIds],
  );

  const newDocuments = useMemo(
    () =>
      (documentsQuery.data ?? []).filter(
        (document) => premiumIds.has(document.client_id) && document.uploaded_by === "client",
      ),
    [documentsQuery.data, premiumIds],
  );

  const recentAccess = useMemo(
    () => (accessQuery.data ?? []).filter((access) => premiumIds.has(access.client_id)),
    [accessQuery.data, premiumIds],
  );

  const recommendationFeedback = useMemo(
    () => (recommendationsQuery.data ?? []).filter((item) => premiumIds.has(item.client_id)),
    [recommendationsQuery.data, premiumIds],
  );

  const countsByClient = useMemo(() => {
    const result = new Map<
      string,
      { pending: number; documents: number; lastAccess: string | null }
    >();
    for (const row of rows) {
      result.set(row.client.id, { pending: 0, documents: 0, lastAccess: null });
    }
    for (const message of pendingMessages) {
      const row = result.get(message.client_id);
      if (row) row.pending += 1;
    }
    for (const document of newDocuments) {
      const row = result.get(document.client_id);
      if (row) row.documents += 1;
    }
    for (const access of recentAccess) {
      const row = result.get(access.client_id);
      if (row && (!row.lastAccess || access.accessed_at > row.lastAccess)) {
        row.lastAccess = access.accessed_at;
      }
    }
    return result;
  }, [newDocuments, pendingMessages, recentAccess, rows]);

  const isLoading =
    adminLoading ||
    clientsQuery.isLoading ||
    premiumQuery.isLoading ||
    messagesQuery.isLoading ||
    documentsQuery.isLoading ||
    accessQuery.isLoading ||
    recommendationsQuery.isLoading;

  const error =
    clientsQuery.error ??
    premiumQuery.error ??
    messagesQuery.error ??
    documentsQuery.error ??
    accessQuery.error ??
    recommendationsQuery.error;

  async function openDocument(document: PremiumDocumentRow) {
    try {
      const url = await signedPremiumDocumentUrl(document.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
    }
  }

  if (!adminLoading && !isAdmin) {
    return (
      <AppShell title="Comptes Premium">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-background p-8 text-center">
          <Crown className="mx-auto h-9 w-9 text-muted-foreground" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Accès administrateur requis</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette page regroupe les informations de suivi des comptes Premium.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Comptes Premium">
      <div className="mx-auto w-full max-w-[1152px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Administration Premium</p>
            <h1 className="text-2xl font-medium tracking-tight">Comptes Premium</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Suivez les comptes, demandes, documents et consultations Premium.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <Crown className="h-3.5 w-3.5 text-primary" />
            {rows.length} actif{rows.length > 1 ? "s" : ""}
          </Badge>
        </header>

        {isLoading ? (
          <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
            Chargement de l'administration Premium…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            {error instanceof Error ? error.message : "Erreur de chargement de Premium."}
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminStat icon={Users} label="Comptes actifs" value={rows.length} />
              <AdminStat
                icon={MessageSquare}
                label="Demandes à traiter"
                value={pendingMessages.length}
                highlight={pendingMessages.length > 0}
              />
              <AdminStat
                icon={FileText}
                label="Documents envoyés par les clients"
                value={newDocuments.length}
                highlight={newDocuments.length > 0}
              />
              <AdminStat
                icon={Activity}
                label="Consultations récentes"
                value={recentAccess.length}
              />
            </section>

            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un client…"
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {rows.length} résultat{rows.length > 1 ? "s" : ""}
              </span>
            </div>

            <section className="overflow-hidden rounded-xl border bg-background">
              <div
                className="hidden grid-cols-[minmax(280px,2fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)_minmax(190px,1fr)_auto] items-center border-b bg-muted/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground lg:grid"
              >
                <span>Client</span>
                <span>Demandes</span>
                <span>Documents</span>
                <span>Dernière consultation</span>
                <span />
              </div>
              <div className="divide-y">
                {rows.map(({ client, premium }) => {
                  const activity = countsByClient.get(client.id);
                  return (
                    <div
                      key={client.id}
                      className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(280px,2fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)_minmax(190px,1fr)_auto] lg:items-center lg:px-5"
                    >
                      <div className="min-w-0">
                        <Link
                          to="/partage/$token"
                          params={{ token: client.share_token }}
                          search={{ intervention: undefined }}
                          className="block truncate text-sm font-medium hover:text-primary"
                        >
                          {displayClientName(client)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {client.address ?? client.email ?? "Aucune information complémentaire"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Premium depuis {fmtDate(premium.activated_at)}
                        </p>
                      </div>
                      <Badge
                        variant={activity?.pending ? "default" : "secondary"}
                        className="w-fit"
                      >
                        {activity?.pending ?? 0}
                      </Badge>
                      <Badge
                        variant={activity?.documents ? "default" : "secondary"}
                        className="w-fit"
                      >
                        {activity?.documents ?? 0}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(activity?.lastAccess ?? null)}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={premiumEmailMutation.isPending}
                          onClick={() => {
                            const recipient = client.email ?? client.emails?.[0];
                            if (!recipient) {
                              toast.error("Aucune adresse e-mail n’est renseignée pour ce client.");
                              return;
                            }
                            if (
                              window.confirm(
                                `Envoyer le mail de mise à disposition du Compte Premium à ${displayClientName(client)} (${recipient}) ?`,
                              )
                            ) {
                              premiumEmailMutation.mutate(client.id);
                            }
                          }}
                        >
                          Prévenir
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/clients/$clientId" params={{ clientId: client.id }}>
                            Fiche client
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/partage/$token"
                            params={{ token: client.share_token }}
                            search={{ intervention: undefined }}
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Ouvrir
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <AdminListCard
                title="Demandes en attente"
                icon={MessageSquare}
                empty="Aucune demande en attente."
              >
                {pendingMessages.slice(0, 12).map((message) => {
                  const client = clientsById.get(message.client_id);
                  if (!client) return null;
                  return (
                    <div key={message.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{displayClientName(client)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmtDateTime(message.created_at)}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {message.kind === "question" ? "Question" : "Demande"}
                        </Badge>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate(message.id)}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          Marquer traitée
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </AdminListCard>

              <AdminListCard
                title="Nouveaux contenus envoyés par les clients"
                icon={FileText}
                empty="Aucun nouveau document envoyé par un client."
              >
                {newDocuments.slice(0, 12).map((document) => {
                  const client = clientsById.get(document.client_id);
                  if (!client) return null;
                  return (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{displayClientName(client)}</p>
                        <p className="truncate text-sm">{document.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {document.filename} · {fmtDateTime(document.created_at)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openDocument(document)}>
                        Ouvrir
                      </Button>
                    </div>
                  );
                })}
              </AdminListCard>

              <AdminListCard
                title="Retours sur les préconisations"
                icon={CheckCircle2}
                empty="Aucun retour client récent."
              >
                {recommendationFeedback.slice(0, 12).map((item) => {
                  const client = clientsById.get(item.client_id);
                  if (!client) return null;
                  const interested = item.client_interest === "interested";
                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-xl border p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{displayClientName(client)}</p>
                        <p className="mt-1 truncate text-sm">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmtDateTime(item.client_interest_at)}
                        </p>
                      </div>
                      <Badge variant={interested ? "default" : "secondary"}>
                        {interested ? "Intéressé" : "Décliné"}
                      </Badge>
                    </div>
                  );
                })}
              </AdminListCard>

              <AdminListCard
                title="Dernières consultations"
                icon={Activity}
                empty="Aucune consultation enregistrée."
              >
                {Array.from(
                  recentAccess.reduce((groups, access) => {
                    const entries = groups.get(access.client_id) ?? [];
                    entries.push(access);
                    groups.set(access.client_id, entries);
                    return groups;
                  }, new Map<string, PremiumAccess[]>()),
                ).map(([clientId, accesses]) => {
                  const client = clientsById.get(clientId);
                  if (!client) return null;
                  const sortedAccesses = [...accesses].sort((a, b) =>
                    b.accessed_at.localeCompare(a.accessed_at),
                  );
                  return (
                    <details key={clientId} className="group rounded-xl border bg-background">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{displayClientName(client)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {sortedAccesses.length} consultation{sortedAccesses.length > 1 ? "s" : ""} · dernière le {fmtDateTime(sortedAccesses[0]?.accessed_at ?? null)}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t px-4 py-3">
                        <div className="space-y-2">
                          {sortedAccesses.map((access, index) => (
                            <div
                              key={`${access.client_id}-${access.accessed_at}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2.5 text-sm"
                            >
                              <span>Consultation de l’interface Premium</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {fmtDateTime(access.accessed_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </AdminListCard>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function AdminStat({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-5 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </Card>
  );
}

function AdminListCard({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof MessageSquare;
  empty: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-serif text-xl">{title}</h2>
      </div>
      <div className="space-y-3 p-4">
        {children || <p className="p-3 text-sm text-muted-foreground">{empty}</p>}
      </div>
    </Card>
  );
}
