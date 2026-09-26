import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { listEmailLog } from "@/lib/email-log.functions";
import { listBrevoEmailLog, type BrevoEmailLogEntry } from "@/lib/brevo-email-log.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Mail,
  MailOpen,
  MousePointerClick,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/emails")({
  head: () => ({
    meta: [{ title: "Gestion et suivi des emails clients — De la graine au jardin" }],
  }),
  component: EmailsPage,
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmailsPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) {
    return (
      <AppShell title="Gestion et suivi des emails clients">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Gestion et suivi des emails clients">
      <Tabs defaultValue="pp" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pp">Comptes rendus (PP)</TabsTrigger>
          <TabsTrigger value="brevo">contact@delagraineaujardin.com</TabsTrigger>
        </TabsList>
        <TabsContent value="pp">
          <PpReportEmails />
        </TabsContent>
        <TabsContent value="brevo">
          <BrevoContactEmails />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Comptes rendus chantiers envoyés depuis PP (service email natif Lovable) */
/* ---------------------------------------------------------------------- */

type FilterKey = "all" | "sent" | "pending" | "failed";

const SENT = ["sent"];
const PENDING = ["pending"];
const FAILED = ["failed", "dlq", "bounced", "complained", "suppressed"];

function bucketOf(status: string): FilterKey {
  if (SENT.includes(status)) return "sent";
  if (PENDING.includes(status)) return "pending";
  if (FAILED.includes(status)) return "failed";
  return "pending";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    sent: "Envoyé",
    pending: "En attente",
    failed: "Échoué",
    dlq: "Échoué (abandonné)",
    bounced: "Rejeté",
    complained: "Plainte",
    suppressed: "Bloqué",
  };
  return map[status] ?? status;
}

function statusVariant(bucket: FilterKey): "default" | "secondary" | "destructive" | "outline" {
  if (bucket === "sent") return "default";
  if (bucket === "pending") return "secondary";
  return "destructive";
}

function PpReportEmails() {
  const fetchLog = useServerFn(listEmailLog);
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: ["email-log"],
    queryFn: () => fetchLog(),
  });

  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const c = { all: rows.length, sent: 0, pending: 0, failed: 0 };
    for (const r of rows) c[bucketOf(r.status)]++;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => bucketOf(r.status) === filter)),
    [rows, filter],
  );

  const cards = [
    {
      key: "all" as const,
      label: "Total",
      value: counts.all,
      icon: Mail,
      color: "text-foreground",
    },
    {
      key: "sent" as const,
      label: "Envoyés",
      value: counts.sent,
      icon: CheckCircle2,
      color: "text-primary",
    },
    {
      key: "pending" as const,
      label: "En attente",
      value: counts.pending,
      icon: Clock,
      color: "text-muted-foreground",
    },
    {
      key: "failed" as const,
      label: "Échoués",
      value: counts.failed,
      icon: AlertTriangle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Suivi des notifications de comptes rendus envoyées aux clients.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)} className="text-left">
            <Card className={filter === c.key ? "border-primary ring-1 ring-primary" : ""}>
              <CardContent className="flex items-center gap-3 p-4">
                <c.icon className={`h-6 w-6 ${c.color}`} />
                <div>
                  <p className="font-serif text-2xl font-semibold leading-none tabular-nums">
                    {c.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive">Impossible de charger le suivi des e-mails.</p>
      )}

      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Aucun e-mail {filter !== "all" ? `« ${statusLabel(filter)} »` : ""} pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Ouvert</TableHead>
                    <TableHead>Erreur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const bucket = bucketOf(r.status);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.recipient_email}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(bucket)}>{statusLabel(r.status)}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {fmtDate(r.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {r.opened_at ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <MailOpen className="h-3.5 w-3.5" />
                              {fmtDate(r.opened_at)}
                              {r.open_count && r.open_count > 1 ? ` (${r.open_count}×)` : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Non ouvert</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs text-destructive">
                          {r.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Emails envoyés depuis contact@delagraineaujardin.com, via Brevo         */
/* ---------------------------------------------------------------------- */

function brevoStatusLabel(status: string): string {
  const map: Record<string, string> = {
    sent: "Envoyé",
    delivered: "Délivré",
    opened: "Ouvert",
    clicked: "Cliqué",
    bounced: "Rejeté",
    spam: "Marqué spam",
    unsubscribed: "Désinscrit",
    error: "Erreur",
  };
  return map[status] ?? status;
}

function brevoStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "opened" || status === "clicked") return "default";
  if (status === "sent" || status === "delivered") return "secondary";
  return "destructive";
}

function BrevoContactEmails() {
  const fetchLog = useServerFn(listBrevoEmailLog);
  const [senderFilter, setSenderFilter] = useState("contact@delagraineaujardin.com");
  const [recipientFilter, setRecipientFilter] = useState("");

  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: ["brevo-email-log"],
    queryFn: () => fetchLog(),
  });

  const rows: BrevoEmailLogEntry[] = useMemo(() => data ?? [], [data]);

  const senders = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.sender_email).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const senderMatches = senderFilter === "all" || row.sender_email === senderFilter;
        const recipientMatches =
          !recipientFilter.trim() ||
          row.recipient_email.toLowerCase().includes(recipientFilter.trim().toLowerCase());
        return senderMatches && recipientMatches;
      }),
    [rows, senderFilter, recipientFilter],
  );

  const hasFilters = senderFilter !== "all" || recipientFilter.trim() !== "";

  const clearFilters = () => {
    setSenderFilter("all");
    setRecipientFilter("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Suivi des emails envoyés via Brevo, du plus récent au plus ancien.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="brevo-sender-filter" className="text-xs font-medium">
              Expéditeur
            </label>
            <select
              id="brevo-sender-filter"
              value={senderFilter}
              onChange={(event) => setSenderFilter(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Tous les expéditeurs</option>
              {senders.map((sender) => (
                <option key={sender} value={sender}>
                  {sender}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="brevo-recipient-filter" className="text-xs font-medium">
              Destinataire
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="brevo-recipient-filter"
                type="search"
                value={recipientFilter}
                onChange={(event) => setRecipientFilter(event.target.value)}
                placeholder="Rechercher une adresse…"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" /> Réinitialiser
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">
          Impossible de charger le suivi des e-mails Brevo.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Aucun e-mail Brevo pour le moment.
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Aucun e-mail ne correspond aux filtres sélectionnés.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expéditeur</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoyé le</TableHead>
                    <TableHead>Ouvert</TableHead>
                    <TableHead>Cliqué</TableHead>
                    <TableHead>Erreur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={r.message_id}>
                      <TableCell className="font-medium">{r.sender_email ?? "—"}</TableCell>
                      <TableCell>{r.recipient_email}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">
                        {r.subject ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={brevoStatusVariant(r.status)}>
                          {brevoStatusLabel(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.sent_at ? fmtDate(r.sent_at) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.first_opened_at ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <MailOpen className="h-3.5 w-3.5" />
                            {fmtDate(r.first_opened_at)}
                            {r.open_count > 1 ? ` (${r.open_count}×)` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Non ouvert</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.first_clicked_at ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <MousePointerClick className="h-3.5 w-3.5" />
                            {fmtDate(r.first_clicked_at)}
                            {r.click_count > 1 ? ` (${r.click_count}×)` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-destructive">
                        {r.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
