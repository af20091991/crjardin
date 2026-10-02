import { useMemo } from "react";
import { Activity, CheckCircle2, ChevronDown, FileText, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signedPremiumDocumentUrl } from "@/lib/client-premium";
import type {
  PremiumAccess,
  PremiumDocumentRow,
  PremiumDocumentView,
  PremiumIntervention,
  PremiumRecommendation,
  PremiumRow,
} from "@/components/premium-admin/data";
import {
  AdminListCard,
  displayClientName,
  fmtDate,
  fmtDateTime,
} from "@/components/premium-admin/shared";

export function ActivityTab({
  rows,
  access,
  documents,
  documentViews,
  recommendations,
  sentReports,
}: {
  rows: PremiumRow[];
  access: PremiumAccess[];
  documents: PremiumDocumentRow[];
  documentViews: PremiumDocumentView[];
  recommendations: PremiumRecommendation[];
  sentReports: PremiumIntervention[];
}) {
  const byId = useMemo(() => new Map(rows.map((row) => [row.client.id, row])), [rows]);
  const nameOf = (clientId: string) => {
    const row = byId.get(clientId);
    return row ? displayClientName(row.client, row.contact) : null;
  };

  const accessByClient = useMemo(() => {
    const groups = new Map<string, PremiumAccess[]>();
    for (const entry of access) {
      groups.set(entry.client_id, [...(groups.get(entry.client_id) ?? []), entry]);
    }
    return Array.from(groups.entries());
  }, [access]);

  const viewById = useMemo(
    () => new Map(documentViews.map((view) => [view.id, view])),
    [documentViews],
  );
  const unread = sentReports.filter((iv) => !iv.client_read_at);

  async function openDocument(document: PremiumDocumentRow) {
    try {
      const url = await signedPremiumDocumentUrl(document.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Impossible d'ouvrir le document.");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <AdminListCard
        title="Comptes-rendus : lecture par les clients"
        icon={MailOpen}
        empty="Aucun compte-rendu envoyé."
      >
        {unread.length > 0 && (
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
            {unread.length} compte{unread.length > 1 ? "s" : ""}-rendu{unread.length > 1 ? "s" : ""}{" "}
            envoyé{unread.length > 1 ? "s" : ""} et pas encore ouvert{unread.length > 1 ? "s" : ""}{" "}
            : bon moment pour relancer.
          </p>
        )}
        {sentReports.slice(0, 12).map((iv) => {
          const name = nameOf(iv.client_id);
          if (!name) return null;
          return (
            <div
              key={iv.id}
              className="flex items-start justify-between gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                <p className="mt-1 truncate text-sm">
                  {iv.title ?? iv.intervention_type ?? "Intervention"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Envoyé le {fmtDate(iv.sent_to_client_at)}
                </p>
              </div>
              <Badge variant={iv.client_read_at ? "secondary" : "default"} className="shrink-0">
                {iv.client_read_at ? `Lu le ${fmtDate(iv.client_read_at)}` : "Non lu"}
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
        {accessByClient.map(([clientId, entries]) => {
          const name = nameOf(clientId);
          if (!name) return null;
          const sorted = [...entries].sort((a, b) => b.accessed_at.localeCompare(a.accessed_at));
          return (
            <details key={clientId} className="group rounded-xl border bg-background">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sorted.length} consultation{sorted.length > 1 ? "s" : ""} · dernière le{" "}
                    {fmtDateTime(sorted[0]?.accessed_at ?? null)}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 border-t px-4 py-3">
                {sorted.slice(0, 20).map((entry, index) => (
                  <div
                    key={`${entry.client_id}-${entry.accessed_at}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2.5 text-sm"
                  >
                    <span>Consultation de l'espace Premium</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmtDateTime(entry.accessed_at)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </AdminListCard>

      <AdminListCard
        title="Documents transmis : consultation par les clients"
        icon={FileText}
        empty="Aucun document transmis à un client."
      >
        {documents
          .filter((document) => document.uploaded_by === "gardener")
          .slice(0, 12)
          .map((document) => {
            const name = nameOf(document.client_id);
            if (!name) return null;
            const view = viewById.get(document.id);
            return (
              <div
                key={document.id}
                className="flex items-start justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-sm">{document.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Transmis le {fmtDate(document.created_at)}
                  </p>
                </div>
                <Badge
                  variant={view?.client_viewed_at ? "secondary" : "default"}
                  className="shrink-0"
                >
                  {view?.client_viewed_at
                    ? `Consulté le ${fmtDate(view.client_viewed_at)}`
                    : "Non consulté"}
                </Badge>
              </div>
            );
          })}
      </AdminListCard>

      <AdminListCard
        title="Nouveaux contenus envoyés par les clients"
        icon={FileText}
        empty="Aucun nouveau document envoyé par un client."
      >
        {documents
          .filter((document) => document.uploaded_by === "client")
          .slice(0, 12)
          .map((document) => {
            const name = nameOf(document.client_id);
            if (!name) return null;
            return (
              <div
                key={document.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
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
        {recommendations.slice(0, 12).map((item) => {
          const name = nameOf(item.client_id);
          if (!name) return null;
          const interested = item.client_interest === "interested";
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{name}</p>
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
    </div>
  );
}
