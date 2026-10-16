import { useRef } from "react";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MAX_FILES,
  chatAttachmentKind,
  formatBytes,
  mergeSelection,
  resolveChatMime,
  validateChatAttachment,
  type ChatAttachmentMeta,
} from "@/lib/message-attachments";

/** Sélecteur de pièces jointes (5 fichiers, 10 Mo chacun) avec liste retirable. */
export function ChatAttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    const incoming = Array.from(list ?? []);
    const valid: File[] = [];
    for (const file of incoming) {
      const problem = validateChatAttachment(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    const { files: next, rejected } = mergeSelection(files, valid);
    if (rejected > 0) toast.error(`${CHAT_ATTACHMENT_MAX_FILES} pièces jointes maximum.`);
    onChange(next);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || files.length >= CHAT_ATTACHMENT_MAX_FILES}
        onClick={() => input.current?.click()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
      >
        <Paperclip className="size-4" />
        Joindre des fichiers (images, PDF, Word, Excel · 10 Mo max, {CHAT_ATTACHMENT_MAX_FILES}{" "}
        fichiers)
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={CHAT_ATTACHMENT_ACCEPT}
        className="sr-only"
        aria-label="Joindre des fichiers"
        onChange={(e) => add(e.target.files)}
        disabled={disabled}
      />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs"
            >
              <AttachmentIcon mime={resolveChatMime(file.name, file.type)} />
              <span className="max-w-40 truncate">{file.name}</span>
              <span className="text-muted-foreground">{formatBytes(file.size)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Retirer ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentIcon({ mime }: { mime: string }) {
  return chatAttachmentKind(mime) === "image" ? (
    <ImageIcon className="size-3.5 text-primary" />
  ) : (
    <FileText className="size-3.5 text-primary" />
  );
}

/** Affichage des pièces jointes d'un message : vignette pour les images, lien sinon. */
export function ChatAttachmentList({ attachments }: { attachments?: ChatAttachmentMeta[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => {
        const isImage = chatAttachmentKind(a.mime_type) === "image" && a.url;
        return (
          <li key={a.id ?? a.storage_path}>
            {a.url ? (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                download={isImage ? undefined : a.filename}
                className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs hover:border-primary"
              >
                {isImage ? (
                  <img
                    src={a.url}
                    alt={a.filename}
                    loading="lazy"
                    className="size-12 rounded object-cover"
                  />
                ) : (
                  <AttachmentIcon mime={a.mime_type} />
                )}
                <span className="max-w-40 truncate">{a.filename}</span>
                <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
              </a>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs text-muted-foreground">
                <AttachmentIcon mime={a.mime_type} />
                {a.filename} · lien indisponible
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
