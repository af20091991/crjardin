import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquare,
  PenSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { clientEmails } from "@/lib/clients";
import { sendPremiumReplyNotification } from "@/lib/premium-email.functions";
import {
  archiveConversation,
  GARDENER_AUTHOR_NAME,
  replyToClient,
  resolveMessage,
} from "@/lib/messages";
import { archiveDayLabel, archivedConversations, openMessages } from "@/lib/message-threads";
import type { PremiumMessage, PremiumRow } from "@/components/premium-admin/data";
import { displayClientName, fmtDateTime } from "@/components/premium-admin/shared";

type View = "pending" | "open" | "archived";

type Outgoing = {
  clientId: string;
  content: string;
  pendingIds: string[];
  emails: string[];
  spontaneous: boolean;
};

function MessageBubble({ message }: { message: PremiumMessage }) {
  const mine = message.sender === "gardener";
  return (
    <div
      className={`rounded-xl px-3 py-2 text-sm ${mine ? "ml-8 bg-primary/10" : "mr-8 bg-muted/40"}`}
    >
      <p className="whitespace-pre-wrap leading-6">{message.content}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {mine ? GARDENER_AUTHOR_NAME : message.kind === "question" ? "Question" : "Client"} ·{" "}
        {fmtDateTime(message.created_at)}
      </p>
    </div>
  );
}

export function InboxTab({
  rows,
  messages,
  composeFor,
}: {
  rows: PremiumRow[];
  messages: PremiumMessage[];
  /** Demande d'ouverture de la rédaction pour un client (bouton « Écrire » des cartes). */
  composeFor?: { clientId: string; nonce: number } | null;
}) {
  const qc = useQueryClient();
  const notify = useServerFn(sendPremiumReplyNotification);
  const [view, setView] = useState<View>("pending");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [composing, setComposing] = useState(false);
  const [composeClientId, setComposeClientId] = useState("");
  const [composeText, setComposeText] = useState("");
  const [confirm, setConfirm] = useState<Outgoing | null>(null);

  useEffect(() => {
    if (!composeFor) return;
    setComposeClientId(composeFor.clientId);
    setComposing(true);
    setView("open");
  }, [composeFor]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["premium-admin-messages"] });

  const threads = useMemo(
    () =>
      rows
        .map((row) => {
          const items = openMessages(messages.filter((m) => m.client_id === row.client.id));
          const pending = items.filter((m) => m.sender === "client" && !m.resolved);
          return { row, items, pending };
        })
        .filter(
          (thread) => thread.items.length > 0 && (view !== "pending" || thread.pending.length > 0),
        )
        .sort((a, b) =>
          b.items[b.items.length - 1].created_at.localeCompare(
            a.items[a.items.length - 1].created_at,
          ),
        ),
    [rows, messages, view],
  );

  const archivedByDay = useMemo(() => {
    const all = rows.flatMap((row) =>
      archivedConversations(messages.filter((m) => m.client_id === row.client.id)).map(
        (conversation) => ({ row, ...conversation }),
      ),
    );
    all.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    const days = new Map<string, typeof all>();
    for (const conversation of all) {
      const day = archiveDayLabel(conversation.archivedAt);
      days.set(day, [...(days.get(day) ?? []), conversation]);
    }
    return Array.from(days.entries());
  }, [rows, messages]);

  const send = useMutation({
    mutationFn: async (input: Outgoing & { withEmail: boolean }) => {
      await replyToClient({
        client_id: input.clientId,
        intervention_id: null,
        content: input.content,
        authorName: null,
      });
      await Promise.all(input.pendingIds.map((id) => resolveMessage(id, true)));
      if (input.withEmail) {
        return notify({ data: { clientId: input.clientId, spontaneous: input.spontaneous } });
      }
      return null;
    },
    onSuccess: (result, input) => {
      toast.success(input.spontaneous ? "Message envoyé au client." : "Réponse envoyée au client.");
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
      if (input.spontaneous) {
        setComposeText("");
        setComposing(false);
        setView("open");
      } else {
        setDrafts((prev) => ({ ...prev, [input.clientId]: "" }));
      }
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer le message."),
  });

  const resolve = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => resolveMessage(id, true))),
    onSuccess: refresh,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible de traiter la demande."),
  });

  const archive = useMutation({
    mutationFn: (clientId: string) => archiveConversation(clientId),
    onSuccess: () => {
      toast.success("Conversation clôturée et classée dans les archives.");
      refresh();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Impossible d'archiver la conversation.",
      ),
  });

  const composeRow = rows.find((row) => row.client.id === composeClientId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={view === "pending" ? "default" : "outline"}
            onClick={() => setView("pending")}
          >
            À traiter
          </Button>
          <Button
            size="sm"
            variant={view === "open" ? "default" : "outline"}
            onClick={() => setView("open")}
          >
            En cours
          </Button>
          <Button
            size="sm"
            variant={view === "archived" ? "default" : "outline"}
            onClick={() => setView("archived")}
          >
            <Archive className="mr-1.5 h-4 w-4" />
            Archivées
          </Button>
        </div>
        <Button size="sm" onClick={() => setComposing((value) => !value)}>
          <PenSquare className="mr-1.5 h-4 w-4" />
          Nouveau message
        </Button>
      </div>

      {composing && (
        <Card className="space-y-3 p-5">
          <p className="font-serif text-lg">
            Écrire à un client Premium · message signé {GARDENER_AUTHOR_NAME}
          </p>
          <select
            value={composeClientId}
            onChange={(event) => setComposeClientId(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            aria-label="Client destinataire"
          >
            <option value="">Choisir un client…</option>
            {rows.map((row) => (
              <option key={row.client.id} value={row.client.id}>
                {displayClientName(row.client, row.contact)}
              </option>
            ))}
          </select>
          <Textarea
            value={composeText}
            maxLength={2000}
            rows={4}
            placeholder="Votre message…"
            onChange={(event) => setComposeText(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!composeRow || !composeText.trim() || send.isPending}
              onClick={() =>
                composeRow &&
                setConfirm({
                  clientId: composeRow.client.id,
                  content: composeText,
                  pendingIds: [],
                  emails: clientEmails(composeRow.client),
                  spontaneous: true,
                })
              }
            >
              <Send className="mr-1.5 h-4 w-4" />
              Envoyer
            </Button>
          </div>
        </Card>
      )}

      {view === "archived" ? (
        archivedByDay.length === 0 ? (
          <Card className="p-10 text-center">
            <Archive className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-serif text-xl">Aucune conversation archivée</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clôturez une conversation terminée pour la classer ici, à la date du jour.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {archivedByDay.map(([day, conversations]) => (
              <section key={day} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Clôturées le {day}</h3>
                <div className="grid gap-3 xl:grid-cols-2">
                  {conversations.map(({ row, archivedAt, messages: items }) => (
                    <details
                      key={`${row.client.id}-${archivedAt}`}
                      className="group rounded-xl border bg-background"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {displayClientName(row.client, row.contact)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {items.length} message{items.length > 1 ? "s" : ""} ·{" "}
                            {items[0].content.slice(0, 70)}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="max-h-72 space-y-2 overflow-y-auto border-t p-4">
                        {items.map((message) => (
                          <MessageBubble key={message.id} message={message} />
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <>
          {threads.length === 0 && (
            <Card className="p-10 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-serif text-xl">
                {view === "pending" ? "Aucune demande en attente" : "Aucune conversation en cours"}
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
                    <p className="truncate font-medium">
                      {displayClientName(row.client, row.contact)}
                    </p>
                    {pending.length > 0 && <Badge>{pending.length} à traiter</Badge>}
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {items.slice(-8).map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={archive.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Clôturer cette conversation et la classer dans les archives à la date du jour ?",
                            )
                          ) {
                            archive.mutate(clientId);
                          }
                        }}
                      >
                        <Archive className="mr-1.5 h-4 w-4" />
                        Clôturer et archiver
                      </Button>
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
                        disabled={!draft.trim() || send.isPending}
                        onClick={() =>
                          setConfirm({
                            clientId,
                            content: draft,
                            pendingIds: pending.map((m) => m.id),
                            emails: clientEmails(row.client),
                            spontaneous: false,
                          })
                        }
                      >
                        <Send className="mr-1.5 h-4 w-4" />
                        Répondre
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && !send.isPending && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.spontaneous ? "Envoyer le message" : "Envoyer la réponse"}
            </DialogTitle>
            <DialogDescription>
              Le message sera visible dans l'espace Premium du client. Souhaitez-vous aussi le
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
            <Button variant="ghost" disabled={send.isPending} onClick={() => setConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="outline"
              disabled={send.isPending}
              onClick={() => confirm && send.mutate({ ...confirm, withEmail: false })}
            >
              Envoyer sans e-mail
            </Button>
            <Button
              disabled={send.isPending || !confirm || confirm.emails.length === 0}
              onClick={() => confirm && send.mutate({ ...confirm, withEmail: true })}
            >
              {send.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Envoyer et prévenir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
