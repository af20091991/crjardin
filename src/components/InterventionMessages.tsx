import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMessagesByClient, replyToClient, resolveMessage } from "@/lib/messages";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessagesSquare, Send, Loader2, Reply, HelpCircle, MessageSquarePlus, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export function InterventionMessages({ clientId, interventionId, authorName }: { clientId: string; interventionId: string; authorName?: string | null }) {
  const qc = useQueryClient();
  const { data: all } = useQuery({ queryKey: ["client-messages", clientId], queryFn: () => listMessagesByClient(clientId) });
  const messages = (all ?? []).filter((m) => m.intervention_id === interventionId);
  const [reply, setReply] = useState("");
  const [author, setAuthor] = useState(authorName ?? "");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-messages", clientId] });
  const send = useMutation({
    mutationFn: () => replyToClient({ client_id: clientId, intervention_id: interventionId, content: reply, authorName: author.trim() || authorName || null }),
    onSuccess: () => { setReply(""); invalidate(); toast.success("Réponse envoyée au client"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const resolve = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => resolveMessage(id, v),
    onSuccess: invalidate,
  });

  if (messages.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <MessagesSquare className="h-5 w-5 text-primary" /> Échanges avec le client
        </h3>
        <div className="space-y-1.5">
          {messages.map((m) => {
            const isGardener = m.sender === "gardener";
            return (
              <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${isGardener ? "ml-6 bg-primary/10" : "bg-muted/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    {isGardener ? <Reply className="h-3 w-3" /> : m.kind === "question" ? <HelpCircle className="h-3 w-3" /> : <MessageSquarePlus className="h-3 w-3" />}
                    {isGardener ? (m.author_name || "Vous") : (m.author_name || "Client")} · {new Date(m.created_at).toLocaleDateString("fr-FR")}
                  </p>
                  {!isGardener && (
                    <button onClick={() => resolve.mutate({ id: m.id, v: !m.resolved })} className="text-xs text-muted-foreground hover:text-primary" title="Marquer traité">
                      {m.resolved ? <Badge variant="outline" className="gap-1"><CheckCheck className="h-3 w-3" />Traité</Badge> : "Marquer traité"}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="reply-author" className="text-xs">Auteur de la réponse</Label>
            <Input id="reply-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Votre nom" className="h-9" />
          </div>
          <div className="flex gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Répondre au client…" />
            <Button disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
