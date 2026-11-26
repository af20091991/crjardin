// Messagerie Premium — règles des pièces jointes (photos et PDF, 10 Mo maximum).
export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_ACCEPT = "image/*,application/pdf,.pdf";

export interface MessageAttachmentInfo {
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_path?: string | null;
  has_attachment?: boolean;
}

function isPdfName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

/** Message d'erreur si le fichier est refusé, sinon null. */
export function attachmentError(file: { name: string; type: string; size: number }): string | null {
  const okType =
    file.type.startsWith("image/") || file.type === "application/pdf" || isPdfName(file.name);
  if (!okType) return "La pièce jointe doit être une photo ou un PDF.";
  if (file.size <= 0) return "Le fichier est vide.";
  if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES)
    return "La pièce jointe ne doit pas dépasser 10 Mo.";
  return null;
}

export function hasAttachment(message: MessageAttachmentInfo): boolean {
  return Boolean(message.has_attachment || message.attachment_path);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Texte du message quand le client ou le jardinier n'écrit que la pièce jointe. */
export function attachmentOnlyContent(filename: string): string {
  return `Pièce jointe : ${filename}`;
}
