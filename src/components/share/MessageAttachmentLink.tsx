import { useState } from "react";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/message-attachments";

/** Lien vers une pièce jointe : l'adresse temporaire est demandée au clic, puis ouverte. */
export function MessageAttachmentLink({
  name,
  size,
  getUrl,
}: {
  name: string | null | undefined;
  size?: number | null;
  getUrl: () => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const label = name || "Pièce jointe";
  const Icon = label.toLowerCase().endsWith(".pdf") ? FileText : Paperclip;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.open(await getUrl(), "_blank", "noopener,noreferrer");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Pièce jointe indisponible");
        } finally {
          setBusy(false);
        }
      }}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-primary hover:bg-muted disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
      <span className="truncate">{label}</span>
      {size ? (
        <span className="shrink-0 text-muted-foreground">· {formatFileSize(size)}</span>
      ) : null}
    </button>
  );
}
