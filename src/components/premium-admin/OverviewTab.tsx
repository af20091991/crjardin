import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Eye,
  FileText,
  MessageSquare,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clientEmails } from "@/lib/clients";
import { sendPremiumWelcomeEmail } from "@/lib/premium-email.functions";
import type { PremiumRow } from "@/components/premium-admin/data";
import {
  AdminStat,
  displayClientName,
  fmtDate,
  fmtDateTime,
} from "@/components/premium-admin/shared";

export function OverviewTab({
  rows,
  access,
  onOpenCalendar,
}: {
  rows: PremiumRow[];
  access: Array<{ client_id: string }>;
  onOpenCalendar: (clientId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const sendPremiumEmail = useServerFn(sendPremiumWelcomeEmail);
  const welcomeMutation = useMutation({
    mutationFn: (clientId: string) => sendPremiumEmail({ data: { clientId } }),
    onSuccess: (result) => toast.success(`E-mail envoyé à ${result.recipient}`),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Impossible d'envoyer l'e-mail Premium.",
      ),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(({ client }) =>
      [client.name, client.civility, client.address, client.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [rows, search]);

  const pending = rows.reduce((sum, row) => sum + row.pendingMessages, 0);
  const documents = rows.reduce((sum, row) => sum + row.clientDocuments, 0);
  const withAlerts = rows.filter((row) => row.alerts.length > 0).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStat icon={Users} label="Comptes actifs" value={rows.length} />
        <AdminStat
          icon={MessageSquare}
          label="Demandes à traiter"
          value={pending}
          highlight={pending > 0}
        />
        <AdminStat
          icon={FileText}
          label="Documents reçus des clients"
          value={documents}
          highlight={documents > 0}
        />
        <AdminStat icon={Activity} label="Consultations récentes" value={access.length} />
        <AdminStat
          icon={AlertTriangle}
          label="Fiches à compléter"
          value={withAlerts}
          highlight={withAlerts > 0}
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
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((row) => {
          const { client, premium } = row;
          const name = displayClientName(client, row.contact);
          return (
            <Card key={client.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {client.address ?? client.email ?? "Aucune information complémentaire"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Premium depuis {fmtDate(premium.activated_at)}
                  </p>
                </div>
                {row.alerts.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-primary/40 text-primary"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {row.alerts.length}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Complète
                  </Badge>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Demandes</dt>
                  <dd className="mt-0.5 font-medium">{row.pendingMessages}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Documents</dt>
                  <dd className="mt-0.5 font-medium">{row.clientDocuments}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Calendrier</dt>
                  <dd className="mt-0.5 font-medium">
                    {row.calendar.length > 0 ? `${row.calendar.length} passages` : "Manquant"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dernier CR</dt>
                  <dd className="mt-0.5 font-medium">{fmtDate(row.lastReportSentAt)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Dernière consultation : {fmtDateTime(row.lastAccess)}
              </p>

              <div className="mt-auto flex flex-wrap justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenCalendar(client.id)}>
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  Calendrier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={welcomeMutation.isPending}
                  onClick={() => {
                    const recipient = client.email ?? clientEmails(client)[0];
                    if (!recipient) {
                      toast.error("Aucune adresse e-mail n'est renseignée pour ce client.");
                      return;
                    }
                    if (
                      window.confirm(
                        `Envoyer le mail de mise à disposition du Compte Premium à ${name} (${recipient}) ?`,
                      )
                    ) {
                      welcomeMutation.mutate(client.id);
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
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Voir comme le client
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            Aucun compte Premium ne correspond à la recherche.
          </p>
        )}
      </div>
    </div>
  );
}
