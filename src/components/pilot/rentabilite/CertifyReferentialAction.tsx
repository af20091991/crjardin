// Certification du référentiel en 1 clic depuis la liste Rentabilité.
// Présentation uniquement : le verdict provient du moteur
// `pilot-attachment-certification` et l'écriture réutilise la mutation
// journalisée `setEntityStatusQuick` du référentiel.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setEntityStatusQuick, type EntityStatus } from "@/lib/pilot-referential";
import { ENTITY_STATUSES_QUERY_KEY } from "@/lib/pilot-entity-rules";
import type { ClientCertification } from "@/lib/pilot-attachment-certification";
import { useRole } from "@/hooks/use-role";

export function CertifyReferentialAction({
  clientId,
  clientName,
  certification,
  onCertified,
}: {
  clientId: string | null;
  clientName: string;
  /** Ligne du rapport de certification pour ce client (absente = hors périmètre). */
  certification: ClientCertification | undefined;
  onCertified?: () => void;
}) {
  const { canEdit } = useRole();
  const qc = useQueryClient();

  const certify = useMutation({
    mutationFn: () =>
      setEntityStatusQuick({
        clientId: clientId!,
        clientName,
        status: "certified_client",
        previousStatus: (certification?.entityStatus ?? "manual_review_required") as EntityStatus,
        reason:
          "Certification du rattachement : toutes les lignes de vente du périmètre sont rapprochées de manière unique et cohérente.",
      }),
    onSuccess: () => {
      toast.success(`${clientName} — référentiel certifié.`);
      qc.invalidateQueries({ queryKey: ENTITY_STATUSES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["referential"] });
      qc.invalidateQueries({ queryKey: ["referential-audit"] });
      qc.invalidateQueries({ queryKey: ["certif-clients"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      onCertified?.();
    },
    onError: (e: unknown) =>
      toast.error(
        `Certification refusée : ${e instanceof Error ? e.message : "erreur inconnue"}. Le statut précédent est conservé.`,
      ),
  });

  if (!clientId || !canEdit || !certification) return null;
  if (certification.entityStatus === "certified_client") return null;

  // Cas non démontrable : jamais de certification, motif affiché immédiatement.
  if (!certification.certifiable) {
    const motif = certification.blockers[0] ?? "Rattachement non démontrable.";
    return (
      <span
        title={motif}
        className="inline-flex max-w-[14rem] items-center gap-1 truncate text-[11px] text-muted-foreground"
      >
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--pp-warning)]" />
        <span className="truncate">{motif}</span>
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={certify.isPending}
      onClick={() => certify.mutate()}
      title="Certifier le rattachement de cette fiche (action journalisée)"
      className="h-7 gap-1 border-primary/40 px-2 text-[11px] text-primary hover:bg-primary/10"
    >
      {certify.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <BadgeCheck className="h-3.5 w-3.5" />
      )}
      {certify.isPending ? "Certification…" : "Certifier"}
    </Button>
  );
}
