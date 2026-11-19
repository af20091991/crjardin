import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { isPrestatairePathAllowed } from "@/lib/prestataire-access";

/** Les quatre modules les plus utilisés sur mobile (statistiques des 30 derniers jours). */
const QUICK_BAR_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/pilot/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/pilot/calendrier", label: "Calendrier", icon: CalendarDays },
  { to: "/pilot/ca", label: "Suivi du CA", icon: TrendingUp },
  { to: "/pilot/assistant-ap", label: "Assistant AP", icon: FileSpreadsheet },
];

/** Barre fixe en bas d'écran, mobile uniquement. Le prestataire ne voit que les écrans qui le concernent. */
export function MobileQuickBar() {
  const { role } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = QUICK_BAR_ITEMS.filter(
    (item) => role !== "prestataire" || isPrestatairePathAllowed(item.to),
  );
  if (items.length === 0) return null;

  return (
    <nav
      data-bottom-nav
      aria-label="Accès rapides"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
