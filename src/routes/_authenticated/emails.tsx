import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { listEmailLog } from "@/lib/email-log.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Mail, MailOpen, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/emails")({
  head: () => ({ meta: [{ title: "Suivi des e-mails — De la graine au jardin" }] }),
  component: EmailsPage,
});

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
  const fetchLog = useServerFn(listEmailLog);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: ["email-log"],
    enabled: isAdmin,
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

  if (isLoading || !isAdmin) {
    return (
      <AppShell title="Suivi des e-mails">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const cards = [
    { key: "all" as const, label: "Total", value: counts.all, icon: Mail, color: "text-foreground" },
    { key: "sent" as const, label: "Envoyés", value: counts.sent, icon: CheckCircle2, color: "text-primary" },
    { key: "pending" as const, label: "En attente", value: counts.pending, icon: Clock, color: "text-muted-foreground" },
    { key: "failed" as const, label: "Échoués", value: counts.failed, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <AppShell title="Suivi des e-mails">
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
                    <p className="text-2xl font-semibold leading-none">{c.value}</p>
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
    </AppShell>
  );
}
