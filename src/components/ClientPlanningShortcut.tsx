import { useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfViewerDialog } from "@/components/PdfViewerDialog";
import { getCeevPlanningUrlByClientId } from "@/lib/client-portal.functions";

/** Raccourci depuis la fiche client : ouvre directement le planning d'entretien annuel (PDF). */
export function ClientPlanningShortcut({
  clientId,
  filename,
}: {
  clientId: string;
  filename: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setOpen(true);
    if (url) return;
    setLoading(true);
    try {
      const res = await getCeevPlanningUrlByClientId({ data: { clientId } });
      setUrl(res.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Planning indisponible");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const title = filename ?? "Planning d'entretien annuel";
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <CalendarDays className="mr-1.5 h-4 w-4" />
        )}
        Planning d'entretien annuel (PDF)
      </Button>
      <PdfViewerDialog open={open} onOpenChange={setOpen} title={title} url={url} />
    </>
  );
}
