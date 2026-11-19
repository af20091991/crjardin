import { useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
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
  const download = async () => {
    if (!url) return;
    const name = title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("téléchargement impossible");
      const objectUrl = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3 p-4">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle className="truncate text-left">{title}</DialogTitle>
          {url && (
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={download}>
                <Download className="mr-1.5 h-4 w-4" /> Télécharger
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Ouvrir
                </a>
              </Button>
            </div>
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
