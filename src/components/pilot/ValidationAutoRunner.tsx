import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { processCertainPendingValidation } from "@/lib/pilot-validation-auto";

/** Lance une fois à l'ouverture du Centre de validation le traitement des cas certains. */
export function ValidationAutoRunner() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void processCertainPendingValidation()
      .then((result) => {
        if (result.linked === 0 && result.validated === 0) return;
        toast.success(
          `Centre de validation : ${result.linked} rattachement(s), ${result.validated} validation(s) automatique(s).`,
        );
      })
      .catch((error: Error) => {
        toast.error(`Auto-validation interrompue : ${error.message}`);
      });
  }, []);

  return null;
}
