import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { WorksiteSheet } from "@/lib/worksite";
import { uploadWorksiteMethodPdf } from "@/lib/worksite";
import { createCompleteWorksiteSheetPdf } from "@/lib/worksite-pdf-complete";
import { listSubcontractors } from "@/lib/subcontractors";
import { parseWorksiteIntervenants } from "@/lib/worksite-sst";
import { sendSstWorksiteSheetEmail } from "@/lib/email/sst-send.functions";

function dateLabel(value: string | null): string {
  if (!value) return "Date non définie";
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SstWorksiteEmailDialog({ sheet }: { sheet: WorksiteSheet }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendEmail = useServerFn(sendSstWorksiteSheetEmail);
  const { data: subcontractors = [] } = useQuery({
    queryKey: ["subcontractors"],
    queryFn: listSubcontractors,
    enabled: open,
  });

  const intervenants = useMemo(() => parseWorksiteIntervenants(sheet.intervenant), [sheet.intervenant]);
  const recipients = useMemo(
    () =>
      intervenants.map((name) => {
        const match = subcontractors.find(
          (s) => s.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
        );
        return { name, email: match?.email?.trim() || null };
      }),
    [intervenants, subcontractors],
  );
  const validRecipients = recipients.filter(
    (r): r is { name: string; email: string } => Boolean(r.email),
  );

  async function handleSend() {
    if (!validRecipients.length) {
      toast.error("Aucune adresse email valide n'est renseignée pour les SST sélectionnés.");
      return;
    }
    setSending(true);
    try {
      const pdfBlob = await createCompleteWorksiteSheetPdf(sheet);
      const pdfUrl = await uploadWorksiteMethodPdf(sheet.id, pdfBlob);
      const commonData = {
        clientName: [sheet.civility?.trim(), sheet.client_name?.trim()].filter(Boolean).join(" "),
        interventionDate: dateLabel(sheet.intervention_date),
        address: sheet.address?.trim() || "Adresse non renseignée",
        intervenants: intervenants.join(", "),
        tasks: sheet.tasks,
        equipment: sheet.equipment,
        epi: sheet.epi,
        notes: sheet.notes?.trim() || "",
        pdfUrl,
      };

      let sent = 0;
      const failures: string[] = [];
      for (const recipient of validRecipients) {
        try {
          const result = await sendEmail({
            data: {
              recipientEmail: recipient.email,
              templateData: { ...commonData, recipientName: recipient.name },
            },
          });
          if (result.success) sent += 1;
          else failures.push(`${recipient.name} : destinataire supprimé des envois`);
        } catch (error) {
          failures.push(`${recipient.name} : ${error instanceof Error ? error.message : "erreur d'envoi"}`);
        }
      }

      if (sent) toast.success(`${sent} fiche méthode SST envoyée${sent > 1 ? "s" : ""}.`);
      if (failures.length) toast.error(`Envoi incomplet : ${failures.join(" · ")}`);
      if (sent === validRecipients.length) setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de préparer ou d'envoyer la fiche SST.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={!sheet} onClick={() => setOpen(true)}>
        <Mail className="mr-1.5 h-4 w-4" />
        Envoyer par mail
      </Button>

      <Dialog open={open} onOpenChange={(value) => !sending && setOpen(value)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Aperçu du mail — fiche méthode SST</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destinataires</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recipients.map((recipient) => (
                  <Badge key={recipient.name} variant={recipient.email ? "secondary" : "destructive"}>
                    {recipient.name}{recipient.email ? ` · ${recipient.email}` : " · email manquant"}
                  </Badge>
                ))}
              </div>
            </div>

            {!recipients.length ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Aucun SST n'est sélectionné sur cette fiche.</AlertDescription>
              </Alert>
            ) : recipients.some((r) => !r.email) ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Les SST sans adresse email ne recevront pas la fiche. Vous pouvez compléter leur adresse
                  dans le référentiel SST avant l'envoi.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="px-6 py-5 text-center">
                <div className="font-serif text-[22px] font-bold text-[#4F8E33]">De la graine au jardin</div>
                <div className="font-serif text-sm italic text-[#EE8627]">au rythme de la nature</div>
              </div>
              <div className="mx-6 border-t border-[#e6e6e6]" />
              <div className="space-y-4 px-6 py-5 font-serif text-[15px] leading-relaxed text-[#2f3a26]">
                <p>Bonjour {validRecipients.map((r) => r.name).join(", ")},</p>
                <p>
                  Voici la fiche méthode SST pour votre intervention sur la mission suivante.
                  Merci de la consulter avant votre arrivée sur le chantier.
                </p>

                <div className="border-l-[3px] border-[#4F8E33] bg-[#f6f8f3] px-4 py-3">
                  <p className="mb-2 text-[17px] font-bold text-[#4F8E33]">Mission</p>
                  <p><strong>Client :</strong> {[sheet.civility?.trim(), sheet.client_name?.trim()].filter(Boolean).join(" ") || "—"}</p>
                  <p><strong>Date :</strong> {dateLabel(sheet.intervention_date)}</p>
                  <p><strong>Adresse :</strong> {sheet.address || "—"}</p>
                  <p><strong>SST :</strong> {intervenants.join(", ") || "—"}</p>
                </div>

                <PreviewSection title="Travaux à réaliser" items={sheet.tasks} numbered />
                <PreviewSection title="Matériel nécessaire" items={sheet.equipment} />
                <PreviewSection title="EPI" items={sheet.epi} />

                {sheet.notes?.trim() ? (
                  <>
                    <h3 className="mt-5 text-[17px] font-bold text-[#4F8E33]">Notes complémentaires</h3>
                    <div className="border-l-[3px] border-[#4F8E33] bg-[#f6f8f3] px-4 py-2">{sheet.notes}</div>
                  </>
                ) : null}

                <div className="rounded-lg bg-[#f6f8f3] px-4 py-5 text-center">
                  <p className="text-lg font-bold text-[#4F8E33]">Fiche méthode SST complète</p>
                  <p className="mt-1 text-sm">Le PDF comprend la fiche complète, le plan du jardin et les repères de tâches lorsqu'ils sont renseignés.</p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#4F8E33] px-4 py-2 font-sans text-sm font-bold text-white">
                    <FileText className="h-4 w-4" /> Ouvrir la fiche méthode SST
                  </div>
                </div>

                <p>Merci d’en prendre connaissance avant l’intervention et de prévoir le matériel et les EPI indiqués.</p>
                <p>Jardinement vôtre,<br /><strong>Anthony Fournier</strong><br />De la graine au jardin</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Le PDF est généré à partir de la dernière version enregistrée de cette fiche. Le lien sécurisé
              transmis par email reste disponible pendant 7 jours.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={sending || !validRecipients.length} onClick={handleSend}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {sending ? "Envoi en cours…" : `Confirmer et envoyer (${validRecipients.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewSection({ title, items, numbered = false }: { title: string; items: string[]; numbered?: boolean }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[17px] font-bold text-[#4F8E33]">{title}</h3>
      {items.length ? items.map((item, index) => <p key={item}>{numbered ? `${index + 1}. ${item}` : `• ${item}`}</p>) : <p className="text-sm text-[#77786f]">Aucun élément renseigné.</p>}
    </section>
  );
}
