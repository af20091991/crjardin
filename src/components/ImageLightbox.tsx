import { useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Wraps any clickable content (usually an <img>) and shows the full image
 * in a zoomable dialog when clicked.
 */
export function ImageLightbox({
  src,
  alt,
  caption,
  children,
}: {
  src: string;
  alt?: string;
  caption?: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in"
        aria-label="Agrandir la photo"
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <figure className="flex flex-col items-center">
            <img
              src={src}
              alt={alt ?? "Photo agrandie"}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            {caption && (
              <figcaption className="mt-2 rounded bg-background/80 px-3 py-1 text-sm text-foreground">
                {caption}
              </figcaption>
            )}
          </figure>
        </DialogContent>
      </Dialog>
    </>
  );
}