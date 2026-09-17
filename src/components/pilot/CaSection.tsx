// Encart repliable de la page Chiffre d'affaires. L'état d'ouverture est
// piloté depuis la page (mémoire persistée) ; ce composant est purement
// visuel : aucun calcul, aucune donnée.
import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import type { CaSectionId } from "@/lib/pilot-ca-sections";

export function CaSection({
  id,
  label,
  open,
  onToggle,
  icon,
  action,
  children,
  accent,
}: {
  id: CaSectionId;
  label: string;
  open: boolean;
  onToggle: (id: CaSectionId) => void;
  icon: ReactNode;
  /** Bouton d'action (ex. « + Ligne ») : reste cliquable, ne bascule pas l'encart. */
  action?: ReactNode;
  children: ReactNode;
  /** Teinte de fond de l'encart (token sémantique). */
  accent?: string;
}) {
  const [everOpened, setEverOpened] = useState(open);
  const shown = open || everOpened;

  return (
    <Card
      data-ca-section={id}
      data-open={open ? "true" : "false"}
      className={accent ? "" : undefined}
      style={accent ? { backgroundColor: accent } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
        <CardTitle
          className="flex items-center gap-2 text-base"
          // Bouton d'en-tête cliquable pour replier/déplier l'encart.
          style={{ display: "flex", alignItems: "center" }}
        >
          <button
            type="button"
            data-testid={`ca-section-toggle-${id}`}
            aria-expanded={open}
            aria-controls={`ca-section-${id}`}
            onClick={() => {
              if (open) setEverOpened(true);
              onToggle(id);
            }}
            className="flex items-center gap-2 rounded text-left font-medium hover:underline"
          >
            <ChevronDown
              className={`h-4 w-4 text-primary transition-transform ${open ? "" : "-rotate-90"}`}
            />
            {icon}
            {label}
          </button>
        </CardTitle>
        <div onClick={(e) => e.stopPropagation()}>{action}</div>
      </CardHeader>
      {shown && open && (
        <CardContent id={`ca-section-${id}`} className="p-0 [&>div]:rounded-b-xl">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
