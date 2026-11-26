import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadPremiumDocument } from "@/lib/client-premium";
import { detectAndImportWorkCalendar } from "@/lib/premium-calendar-detect";
import { sendPremiumDocumentNotification } from "@/lib/premium-email.functions";

const MAX_BYTES = 20 * 1024 * 1024;

/** Ajouter un document au client depuis son dashboard : visible dans son espace + e-mail avec lien direct. */
export function DashboardDocumentSender({
  clientId,
  premiumKey,
}: {
  clientId: string;
  premiumKey: readonly unknown[];
}) {
  const qc = useQueryClient();
  const notify = useServerFn(sendPremiumDocumentNotification);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [withEmail, setWithEmail] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choisissez un fichier.");
      const docTitle = title.trim() || file.name;
      const added = await uploadPremiumDocument(clientId, file, docTitle.slice(0, 200));
      const detected = await detectAndImportWorkCalendar(clientId, file, added).catch(() => 0);
      if (detected > 0)
        toast.success(`Calendrier de travaux détecté : ${detected} interventions importées.`);
      return withEmail ? notify({ data: { clientId, documentTitle: docTitle } }) : null;
    },
    onSuccess: (result) => {
      toast.success("Document ajouté à l'espace du client.");
      if (result) {
        const sent = result.results.filter((r) => r.status === "sent").map((r) => r.recipient);
        if (sent.length > 0) toast.success(`Client prévenu par e-mail : ${sent.join(", ")}`);
        else toast.error("Le client n'a pas pu être prévenu par e-mail.");
      }
      setTitle("");
      setFile(null);
      void qc.invalidateQueries({ queryKey: [...premiumKey] });
      void qc.invalidateQueries({ queryKey: ["premium-admin-documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mb-4 space-y-3 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Envoyer un document au client
      </p>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="Titre du document (facultatif)"
        aria-label="Titre du document"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!picked) return;
              if (picked.size > MAX_BYTES) toast.error("Le fichier dépasse 20 Mo.");
              else setFile(picked);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="mr-1.5 h-4 w-4" />{" "}
            {file ? "Changer de fichier" : "Choisir un fichier"}
          </Button>
          {file && <span className="max-w-[16rem] truncate text-sm">{file.name}</span>}
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc-notify"
              checked={withEmail}
              onCheckedChange={(v) => setWithEmail(v === true)}
            />
            <Label htmlFor="doc-notify" className="text-sm">
              Prévenir le client par e-mail
            </Label>
          </div>
        </div>
        <Button size="sm" disabled={!file || send.isPending} onClick={() => send.mutate()}>
          Envoyer
        </Button>
      </div>
    </Card>
  );
}
