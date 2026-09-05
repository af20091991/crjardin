import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listSubcontractors } from "@/lib/subcontractors";
import { SstCreateMissionDialog } from "@/components/pilot/SstCreateMissionDialog";
import { Plus } from "lucide-react";

/**
 * Action de création du Journal SST.
 * Le formulaire historique SstCreateMissionDialog reste la fiche de saisie de référence ;
 * ce composant ne fait qu'exposer son ouverture depuis le Journal SST et rafraîchir les
 * requêtes du journal après création.
 */
export function SstJournalCreateAction() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: subcontractors = [], isLoading } = useQuery({
    queryKey: ["sst-list"],
    queryFn: listSubcontractors,
  });

  const handleCreated = () => {
    qc.invalidateQueries({ queryKey: ["sst-missions"] });
    qc.invalidateQueries({ queryKey: ["sst-pnl"] });
    qc.invalidateQueries({ queryKey: ["sst-audit"] });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={isLoading || subcontractors.length === 0}>
        <Plus className="mr-2 h-4 w-4" />
        Nouvelle mission
      </Button>
      <SstCreateMissionDialog
        open={open}
        onOpenChange={setOpen}
        subcontractors={subcontractors}
        onCreated={handleCreated}
      />
    </>
  );
}
