/** Miniature d'une photo stockée dans Supabase Storage (transformation à la volée).
 *  Retourne l'URL d'origine si ce n'est pas un fichier Storage public. */
export function photoThumbUrl(url: string, width = 640): string {
  const marker = "/storage/v1/object/public/";
  if (!url.includes(marker)) return url;
  const renderd = url.replace(marker, "/storage/v1/render/image/public/");
  const sep = renderd.includes("?") ? "&" : "?";
  return `${renderd}${sep}width=${width}&quality=70`;
}
