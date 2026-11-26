import { useState } from "react";
import { photoThumbUrl } from "@/lib/photo-thumb";

/** Miniature légère ; repli automatique sur la photo d'origine si la transformation échoue. */
export function ThumbImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? src : photoThumbUrl(src)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
