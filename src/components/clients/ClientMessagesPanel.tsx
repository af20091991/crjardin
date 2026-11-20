import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, ClipboardList, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listMessagesByClient, replyToClient, resolveMessage } from "@/lib/messages";

/**
 * Échanges avec le client (hors compte-rendu) : lecture, réponse et suivi,
 * quel que soit le statut Premium. Les messages liés à un compte-rendu renvoient vers celui-ci.
 */
export function ClientMessagesPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["client-messages", clientId],
    queryFn: () => listMessagesByClient(clientId),
  });
  const [reply, setReply] = useState("");
  const [author, setAuthor] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-messages", clientId] });

  const send = useMutation({
    mutationFn: () =>
      replyToClient({
        client_id: clientId,
        intervention_id: null,
        content: reply.trim(),
        authorName: author.trim() || null,
      }),
    onSuccess: () => {
      setReply("");
      invalidate();
      toast.success("Réponse envoyée au client");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Envoi impossible"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      resolveMessage(id, resolved),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible"),
  });

  const messages = data ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <h2 className="font-serif text-lg font-semibold">Messages du client</h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {messages.map((m) => {
              const fromClient = m.sender === "client";
              return (
                <li
                  key={m.id}
                  className={`max-w-[85%] space-y-1 rounded-xl border p-3 text-sm ${
                    fromClient ? "bg-muted/40" : "ml-auto bg-primary/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {m.author_name ?? (fromClient ? "Client" : "Jardin")} ·{" "}
                      {new Date(m.created_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.intervention_id && (
                      <Link
                        to="/interventions/$interventionId"
                        params={{ interventionId: m.intervention_id }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ClipboardList className="h-3.5 w-3.5" /> Compte-rendu lié
                      </Link>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {fromClient && (
                    <Button
                      variant={m.resolved ? "ghost" : "outline"}
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: m.id, resolved: !m.resolved })}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {m.resolved ? "Traité" : "Marquer comme traité"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-reply-author" className="text-xs">
              Auteur de la réponse
            </Label>
            <Input
              id="client-reply-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Votre nom"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={2}
              placeholder="Répondre au client…"
              aria-label="Réponse au client"
            />
            <Button disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Envoyer</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
