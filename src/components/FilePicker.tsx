import { useId } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de fichier au style des boutons PP (remplace le « Parcourir » natif du navigateur).
 * L'input est masqué mais reste focusable : le bouton reçoit l'anneau de focus au clavier.
 */
export function FilePicker({
  id,
  accept,
  disabled,
  fileName,
  onFile,
  label = "Choisir un fichier",
}: {
  id?: string;
  accept: string;
  disabled?: boolean;
  fileName?: string | null;
  onFile: (file: File | null) => void;
  label?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          // Vider l'input : re-choisir le même fichier déclenche bien un changement.
          e.target.value = "";
          onFile(file);
        }}
      />
      <label
        htmlFor={inputId}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {label}
      </label>
      <span className="text-sm text-muted-foreground">{fileName ?? "Aucun fichier choisi"}</span>
    </div>
  );
}
