import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Affiche un PDF directement dans l'appli / le navigateur, sans téléchargement. */
export function PdfViewerDialog({
  open,
  onOpenChange,
  title,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3 p-4">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle className="truncate text-left">{title}</DialogTitle>
          {url && (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Ouvrir dans un onglet
              </a>
            </Button>
          )}
        </DialogHeader>
        {url ? (
          <iframe
            src={url}
            title={title}
            className="min-h-0 w-full flex-1 rounded-md border-0 bg-muted"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Document indisponible.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Bouton « Voir » : ouvre le document dans le visualiseur intégré. */
export function ViewDocumentButton({
  title,
  getUrl,
  disabled,
}: {
  title: string;
  getUrl: () => Promise<string>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setOpen(true);
    if (url) return;
    setLoading(true);
    try {
      setUrl(await getUrl());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Document indisponible");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voir"
        title="Voir"
        disabled={disabled || loading}
        onClick={handleClick}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      </Button>
      <PdfViewerDialog open={open} onOpenChange={setOpen} title={title} url={url} />
    </>
  );
}
