// Bouton unique « Gestion incluse / Gestion exclue » des vignettes de taux
// horaire. Aucun calcul ici : il ne fait que basculer la préférence partagée.
import { Button } from "@/components/ui/button";
import { GESTION_MODE_HELP } from "@/lib/pilot-gestion-hours";
import { useGestionMode } from "@/lib/pilot-gestion-mode";

export function GestionToggle({ className }: { className?: string }) {
  const { includeGestion, setIncludeGestion } = useGestionMode();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`h-6 gap-1 px-2 text-[11px] font-medium ${className ?? ""}`}
      title={includeGestion ? GESTION_MODE_HELP.incluse : GESTION_MODE_HELP.exclue}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIncludeGestion(!includeGestion);
      }}
    >
      {includeGestion ? "Gestion incluse" : "Gestion exclue"}
    </Button>
  );
}
