// Messagerie et dépôt de documents de l'espace client (partage).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import {
  addClientMessage,
  createSharedPremiumDocumentUpload,
  finalizeSharedPremiumDocumentUpload,
  type ClientMessage,
} from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, HelpCircle, Send, Loader2, Reply, Upload } from "lucide-react";
import { toast } from "sonner";

export function PremiumDocumentUpload({
  token,
  onUploaded,
}: {
  token: string;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const target = await createSharedPremiumDocumentUpload({
        data: { token, filename: file.name, size: file.size },
      });
      const { error: uploadError } = await supabase.storage
        .from("client-premium")
        .uploadToSignedUrl(target.path, target.token, file);
      if (uploadError) throw new Error(`Envoi impossible : ${uploadError.message}`);
      await finalizeSharedPremiumDocumentUpload({
        data: {
          token,
          path: target.path,
          filename: file.name,
          size: file.size,
          title: title || file.name,
        },
      });
      setTitle("");
      toast.success("Document envoyé à votre jardinier");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 border-t pt-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre (ex : photo d'un problème)"
        disabled={busy}
      />
      <Button type="button" variant="outline" disabled={busy} asChild>
        <label className="cursor-pointer">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <input type="file" className="hidden" onChange={upload} disabled={busy} />
        </label>
      </Button>
    </div>
  );
}

// prettier-ignore
export function GeneralMessages({ token, messages }: { token: string; messages: ClientMessage[] }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 pt-6">
        <h3 className="font-medium">Une question d'ordre général ?</h3>
        <p className="text-sm text-muted-foreground">
          Laissez un message à votre jardinier, il sera notifié immédiatement.
        </p>
        <MessageThread token={token} interventionId={null} messages={messages} />
      </CardContent>
    </Card>
  );
}

/* ---------- Message thread with gardener replies (client #4) ---------- */
// prettier-ignore
export function MessageThread({
  token,
  interventionId,
  messages,
}: {
  token: string;
  interventionId: string | null;
  messages: ClientMessage[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"annotation" | "question">("annotation");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");

  const send = useMutation({
    mutationFn: () =>
      addClientMessage({
        data: { token, interventionId, kind, content, authorName: name || null },
      }),
    onSuccess: () => {
      toast.success("Message envoyé. Votre jardinier a été notifié.");
      setContent("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["shared-messages", token] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-2 border-t pt-3">
      {messages.length > 0 && (
        <div className="space-y-1.5">
          {messages.map((m) => {
            const isGardener = m.sender === "gardener";
            return (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm ${isGardener ? "ml-6 bg-primary/10" : "bg-muted/60"}`}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  {isGardener ? (
                    <Reply className="h-3 w-3" />
                  ) : m.kind === "question" ? (
                    <HelpCircle className="h-3 w-3" />
                  ) : (
                    <MessageSquarePlus className="h-3 w-3" />
                  )}
                  {isGardener
                    ? "Réponse d'Anthony"
                    : m.kind === "question"
                      ? "Votre question"
                      : "Votre annotation"}
                  {m.author_name ? ` · ${m.author_name}` : ""}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Ajouter une annotation ou une question
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={kind === "annotation" ? "default" : "outline"}
              onClick={() => setKind("annotation")}
            >
              <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Annotation
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "question" ? "default" : "outline"}
              onClick={() => setKind("question")}
            >
              <HelpCircle className="mr-1.5 h-4 w-4" /> Question
            </Button>
          </div>
          <Input
            placeholder="Votre nom (facultatif)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder={
              kind === "question" ? "Posez votre question…" : "Votre remarque sur ce compte-rendu…"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!content.trim() || send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Envoyer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// prettier-ignore
