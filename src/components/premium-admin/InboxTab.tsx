import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientEmails } from "@/lib/clients";
import { sendPremiumReplyNotification } from "@/lib/premium-email.functions";
import { replyToClient, resolveMessage } from "@/lib/messages";
import type { PremiumMessage, PremiumRow } from "@/components/premium-admin/data";
import { displayClientName, fmtDateTime } from "@/components/premium-admin/shared";

export function InboxTab({ rows, messages }: { rows: PremiumRow[]; messages: PremiumMessage[] }) {
  const qc = useQueryClient();
  const [onlyPending, setOnlyPending] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const threads = useMemo(() => {
    return rows
      .map((row) => {
        const items = messages
          .filter((m) => m.client_id === row.client.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const pending = items.filter((m) => m.sender === "client" && !m.resolved);
        return { row, items, pending };
      })
      .filter((thread) => thread.items.length > 0 && (!onlyPending || thread.pending.length > 0))
      .sort((a, b) => {
        const last = (t: typeof a) => t.items[t.items.length - 1].created_at;
        return last(b).localeCompare(last(a));
      });
  }, [rows, messages, onlyPending]);

  const notify = useServerFn(sendPremiumReplyNotification);
  const [confirm, setConfirm] = useState<{
    clientId: string;
    content: string;
    pendingIds: string[];
    emails: string[];
  } | null>(null);

  const reply = useMutation({
    mutationFn: async (input: {
      clientId: string;
      content: string;
      pendingIds: string[];
      withEmail: boolean;
    }) => {
      await replyToClient({
        client_id: input.clientId,
        intervention_id: null,
        content: input.content,
        authorName: null,
      });
      await Promise.all(input.pendingIds.map((id) => resolveMessage(id, true)));
      if (input.withEmail) return notify({ data: { clientId: input.clientId } });
      return null;
    },
    onSuccess: (result, input) => {
      toast.success("Réponse envoyée au client.");
      if (result) {
        const sent = result.results.filter((r) => r.status === "sent").map((r) => r.recipient);
        const failed = result.results.filter(
          (r) => r.status === "failed" || r.status === "suppressed",
        );
        if (sent.length > 0) toast.success(`E-mail de prévenance envoyé à : ${sent.join(", ")}`);
        if (failed.length > 0) {
          toast.error(`E-mail non envoyé à : ${failed.map((r) => r.recipient).join(", ")}`);
        }
      }
      setConfirm(null);
      setDrafts((prev) => ({ ...prev, [input.clientId]: "" }));
      qc.invalidateQueries({ queryKey: ["premium-admin-messages"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer la réponse."),
  });

  const resolve = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => resolveMessage(id, true))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["premium-admin-messages"] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible de traiter la demande."),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={onlyPending ? "default" : "outline"}
          onClick={() => setOnlyPending(true)}
        >
          À traiter
        </Button>
        <Button
          size="sm"
          variant={onlyPending ? "outline" : "default"}
          onClick={() => setOnlyPending(false)}
        >
          Toutes les conversations
        </Button>
      </div>

      {threads.length === 0 && (
        <Card className="p-10 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-serif text-xl">
            {onlyPending ? "Aucune demande en attente" : "Aucune conversation"}
          </p>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {threads.map(({ row, items, pending }) => {
          const clientId = row.client.id;
          const draft = drafts[clientId] ?? "";
          return (
            <Card key={clientId} className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-medium">{displayClientName(row.client, row.contact)}</p>
                {pending.length > 0 && <Badge>{pending.length} à traiter</Badge>}
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {items.slice(-8).map((message) => {
                  const mine = message.sender === "gardener";
                  return (
                    <div
                      key={message.id}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        mine ? "ml-8 bg-primary/10" : "mr-8 bg-muted/40"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {mine ? "Vous" : message.kind === "question" ? "Question" : "Client"} ·{" "}
                        {fmtDateTime(message.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={draft}
                  maxLength={2000}
                  rows={3}
                  placeholder="Votre réponse au client…"
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [clientId]: event.target.value }))
                  }
                />
                <div className="flex flex-wrap justify-end gap-2">
                  {pending.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate(pending.map((m) => m.id))}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Marquer traité
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={!draft.trim() || reply.isPending}
                    onClick={() =>
                      setConfirm({
                        clientId,
                        content: draft,
                        pendingIds: pending.map((m) => m.id),
                        emails: clientEmails(row.client),
                      })
                    }
                  >
                    {reply.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" />
                    )}
                    Répondre
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && !reply.isPending && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer la réponse</DialogTitle>
            <DialogDescription>
              La réponse sera visible dans l'espace Premium du client. Souhaitez-vous aussi le
              prévenir par e-mail ?
            </DialogDescription>
          </DialogHeader>
          {confirm && confirm.emails.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-muted/30 p-3 text-sm">
              {confirm.emails.map((email) => (
                <li key={email}>{email}</li>
              ))}
            </ul>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={reply.isPending} onClick={() => setConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="outline"
              disabled={reply.isPending}
              onClick={() => confirm && reply.mutate({ ...confirm, withEmail: false })}
            >
              Répondre sans e-mail
            </Button>
            <Button
              disabled={reply.isPending || !confirm || confirm.emails.length === 0}
              onClick={() => confirm && reply.mutate({ ...confirm, withEmail: true })}
            >
              {reply.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Répondre et prévenir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
