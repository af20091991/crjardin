import type { ComponentType } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  Images,
  Leaf,
  MessageCircle,
  Sprout,
} from "lucide-react";
import type { PremiumSection } from "@/components/share/PremiumHome";

interface NavItem {
  id: PremiumSection;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

/** Navigation à plat : chaque rubrique est une page directe, sans sous-menu. */
export const PREMIUM_NAV: NavItem[] = [
  { id: "home", label: "Accueil", icon: Home },
  { id: "garden", label: "Le jardin", icon: Leaf },
  { id: "reports", label: "Interventions", icon: ClipboardList },
  { id: "recommendations", label: "Préconisations", icon: Sprout },
  { id: "calendar", label: "Calendrier travaux", icon: CalendarDays },
  { id: "photos", label: "Photos", icon: Images },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "exchange", label: "Échanger", icon: MessageCircle },
];

export function PremiumNav({
  section,
  onNavigate,
  className = "",
  pendingRecommendations = 0,
  pendingMessages = 0,
}: {
  section: PremiumSection;
  onNavigate: (section: PremiumSection) => void;
  className?: string;
  /** Préconisations encore sans réponse du client : affichées en pastille à côté de l'onglet. */
  pendingRecommendations?: number;
  /** Messages du gérant non encore ouverts par le client : affichés en « +N » sur la messagerie. */
  pendingMessages?: number;
}) {
  return (
    <div
      className={`premium-carnet-nav sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur ${className}`}
    >
      <nav
        className="mx-auto flex w-full max-w-[1320px] items-stretch gap-1 overflow-x-auto px-3 sm:gap-2 sm:px-10 lg:px-16"
        aria-label="Navigation Premium"
      >
        {PREMIUM_NAV.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          const pending =
            id === "recommendations" ? pendingRecommendations : id === "exchange" ? pendingMessages : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 shrink-0 flex-col items-center justify-center gap-1 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:min-h-[4.5rem] sm:px-4 ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
              <span>{label}</span>
              {pending > 0 && (
                <span
                  className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-5 text-primary-foreground"
                  aria-label={
                    id === "exchange"
                      ? `${pending} message${pending > 1 ? "s" : ""} du jardinier non lu${pending > 1 ? "s" : ""}`
                      : `${pending} préconisation${pending > 1 ? "s" : ""} en attente de décision`
                  }
                >
                  {id === "exchange" ? `+${pending}` : pending}
                </span>
              )}
            </button>
          );
        })}
        <p className="ml-auto flex shrink-0 items-center whitespace-nowrap px-3 text-xs text-muted-foreground sm:px-4">
          Interface Premium Jardin Signature: activée
        </p>
      </nav>
    </div>
  );
}
