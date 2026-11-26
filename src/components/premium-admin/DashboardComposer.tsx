import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GARDENER_AUTHOR_NAME, replyToClient } from "@/lib/messages";
import { MESSAGE_ATTACHMENT_ACCEPT, attachmentError } from "@/lib/message-attachments";
import { sendPremiumReplyNotification } from "@/lib/premium-email.functions";

/** Écrire au client depuis son dashboard : message signé de mon nom, e-mail de prévenance au client. */
export function DashboardComposer({
  clientId,
  messagesKey,
  hasClientMessages,
}: {
  clientId: string;
  messagesKey: readonly unknown[];
  /** true si le client a déjà écrit : le mail devient « J'ai répondu », sinon « Un message pour vous ». */
  hasClientMessages: boolean;
}) {
  const qc = useQueryClient();
  const notify = useServerFn(sendPremiumReplyNotification);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [withEmail, setWithEmail] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: async () => {
      await replyToClient({
        client_id: clientId,
        intervention_id: null,
        content: text,
        authorName: null,
        file,
      });
      return withEmail ? notify({ data: { clientId, spontaneous: !hasClientMessages } }) : null;
    },
    onSuccess: (result) => {
      toast.success("Message envoyé au client.");
      if (result) {
        const sent = result.results.filter((r) => r.status === "sent").map((r) => r.recipient);
        if (sent.length > 0) toast.success(`Client prévenu par e-mail : ${sent.join(", ")}`);
        else toast.error("Le client n'a pas pu être prévenu par e-mail.");
      }
      setText("");
      setFile(null);
      void qc.invalidateQueries({ queryKey: [...messagesKey] });
      void qc.invalidateQueries({ queryKey: ["premium-admin-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = (text.trim().length > 0 || !!file) && !send.isPending;

  return (
    <Card className="space-y-3 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Écrire au client — signé « {GARDENER_AUTHOR_NAME} »
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="Votre message au client…"
        aria-label="Message au client"
      />
      {file && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span className="truncate">{file.name}</span>
          <button type="button" aria-label="Retirer la pièce jointe" onClick={() => setFile(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={MESSAGE_ATTACHMENT_ACCEPT}
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!picked) return;
              const problem = attachmentError(picked);
              if (problem) toast.error(problem);
              else setFile(picked);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="mr-1.5 h-4 w-4" /> Joindre
          </Button>
          <div className="flex items-center gap-2">
            <Checkbox
              id="dash-notify"
              checked={withEmail}
              onCheckedChange={(v) => setWithEmail(v === true)}
            />
            <Label htmlFor="dash-notify" className="text-sm">
              Prévenir le client par e-mail
            </Label>
          </div>
        </div>
        <Button size="sm" disabled={!canSend} onClick={() => send.mutate()}>
          <Send className="mr-1.5 h-4 w-4" /> Envoyer
        </Button>
      </div>
    </Card>
  );
}
