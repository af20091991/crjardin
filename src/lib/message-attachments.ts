/** Règles des pièces jointes du chat client ↔ entreprise (partagées client / serveur). */

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_FILES = 5;
/** Durée de validité des liens de téléchargement signés (secondes). */
export const CHAT_ATTACHMENT_URL_TTL = 60 * 60;

/** Doit rester identique à public.is_allowed_chat_attachment_mime (migration). */
export const CHAT_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
] as const;

export const CHAT_ATTACHMENT_ACCEPT = [
  ...CHAT_ATTACHMENT_MIME_TYPES,
  ".heic",
  ".heif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".odt",
  ".ods",
  ".csv",
  ".txt",
].join(",");

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
};

export interface ChatAttachmentMeta {
  id?: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url?: string | null;
}

export function isAllowedChatMime(mime: string): boolean {
  return (CHAT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mime);
}

/** Type MIME effectif : celui du navigateur, sinon déduit de l'extension (ex. HEIC sur iOS). */
export function resolveChatMime(filename: string, browserType: string): string {
  if (browserType && isAllowedChatMime(browserType)) return browserType;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? browserType ?? "";
}

/** Retourne un message d'erreur en français, ou null si le fichier est accepté. */
export function validateChatAttachment(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (!file.name) return "Nom de fichier invalide.";
  if (!Number.isFinite(file.size) || file.size <= 0) return `« ${file.name} » est vide.`;
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    return `« ${file.name} » dépasse 10 Mo (${formatBytes(file.size)}).`;
  }
  if (!isAllowedChatMime(resolveChatMime(file.name, file.type))) {
    return `« ${file.name} » : type de fichier non autorisé (images, PDF, Word, Excel, texte).`;
  }
  return null;
}

/** Nom de fichier sûr pour le stockage (ASCII, sans séparateur de chemin). */
export function safeStorageName(filename: string): string {
  const cleaned = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .slice(-100);
  return cleaned || "fichier";
}

/** Chemin de stockage déterministe : un réessai réécrit le même objet (pas de doublon). */
export function chatAttachmentPath(
  clientId: string,
  requestId: string,
  index: number,
  filename: string,
): string {
  return `${clientId}/${requestId}/${index}-${safeStorageName(filename)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export function chatAttachmentKind(mime: string): "image" | "pdf" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "file";
}

/** Fusionne une nouvelle sélection en respectant le maximum et sans doublon (nom + taille). */
export function mergeSelection<T extends { name: string; size: number }>(
  current: T[],
  incoming: T[],
): { files: T[]; rejected: number } {
  const files = [...current];
  let rejected = 0;
  for (const file of incoming) {
    if (files.some((f) => f.name === file.name && f.size === file.size)) continue;
    if (files.length >= CHAT_ATTACHMENT_MAX_FILES) {
      rejected += 1;
      continue;
    }
    files.push(file);
  }
  return { files, rejected };
}
