import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { useRole } from "@/hooks/use-role";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { GlobalSearch } from "@/components/pilot/GlobalSearch";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  CalendarDays,
  BarChart3,
  History,
  Mail,
  MoreHorizontal,
  ClipboardList,
  FileText,
  ChevronDown,
  Database,
  BookOpen,
  Compass,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  HardHat,
  Home,
  Euro,
  Target,
  Calculator,
  CalendarRange,
  Receipt,
  Activity,
  LineChart,
  Clock,
  HeartPulse,
  Settings2,
  ShieldCheck,
  MapPin,
  Leaf,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";
import { useAppearance } from "@/lib/appearance";
import { usePilotPeriod, usePilotYear } from "@/lib/pilot-mode";
import { PERIOD_LABELS, type PeriodMode } from "@/lib/pilot-realized";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DirecteurIA } from "@/components/DirecteurIA";

type NavItem = {
  to: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  primary: boolean;
};
type NavGroup = { label: string; items: NavItem[]; emptyLabel?: string };

// État d'ouverture des rubriques : conservé pendant toute la navigation interne
// (module scope = réinitialisé uniquement au rechargement complet de la page).
// Un seul bloc ouvert par défaut : la rubrique la plus utilisée.
export const DEFAULT_OPEN_GROUP = "Aujourd'hui";
let navGroupState: Record<string, boolean> = { [DEFAULT_OPEN_GROUP]: true };

/** Filtre de la palette de commande : recherche insensible casse/accents. */
export function filterNavItems<T extends { label: string; short: string; to: string }>(
  items: T[],
  query: string,
): T[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const q = norm(query.trim());
  if (!q) return items;
  return items.filter((i) => norm(`${i.label} ${i.short} ${i.to}`).includes(q));
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canEdit } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { appearance } = useAppearance();
  const isPilot = pathname === "/pilot" || pathname.startsWith("/pilot/");

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("cr-sidebar-collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("cr-sidebar-collapsed") !== null) return;
    if (appearance.sidebarCollapsedDefault) setCollapsed(true);
  }, [appearance.sidebarCollapsedDefault]);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem("cr-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  // Menu condensé en 5 rubriques (PP v2.3+).
  const groups: NavGroup[] = [
    {
      label: "Aujourd'hui",
      items: [
        {
          to: "/pilot",
          label: "Centre de décision",
          short: "Accueil",
          icon: Home,
          exact: true,
          primary: true,
        },
        ...(canEdit
          ? [
              {
                to: "/pilot/ca",
                label: "Chiffre d'affaires",
                short: "CA",
                icon: Euro,
                exact: false,
                primary: false,
              },
              {
                to: "/pilot/sante",
                label: "Santé de l'activité",
                short: "Santé",
                icon: HeartPulse,
                exact: false,
                primary: false,
              },
            ]
          : []),
      ],
    },
    {
      label: "Pilotage",
      items: canEdit
        ? [
            {
              to: "/pilot/direction",
              label: "Direction",
              short: "Direction",
              icon: BarChart3,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/ceev",
              label: "Rentabilité CEEV",
              short: "CEEV €",
              icon: ClipboardList,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/objectifs",
              label: "Objectifs",
              short: "Objectifs",
              icon: Target,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/benchmark",
              label: "Comparatifs et prévisions",
              short: "Compar.",
              icon: CalendarRange,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/temps",
              label: "Analyse temps & rentabilité",
              short: "Temps",
              icon: Clock,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/finance",
              label: "Finance",
              short: "Finance",
              icon: Calculator,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/charges",
              label: "Charges & investissements",
              short: "Charges",
              icon: Receipt,
              exact: false,
              primary: false,
            },
            {
              to: "/pilot/simulations",
              label: "Simulations",
              short: "Simul.",
              icon: Calculator,
              exact: false,
              primary: false,
            },
          ]
        : [],
      emptyLabel: canEdit ? undefined : "Réservé",
    },
    {
      label: "Clients",
      items: [
        {
          to: "/clients",
          label: "Fiches clients",
          short: "Clients",
          icon: Users,
          exact: false,
          primary: true,
        },
        ...(canEdit
          ? [
              {
                to: "/pilot/rentabilite",
                label: "Rentabilité",
                short: "Rentab.",
                icon: LineChart,
                exact: false,
                primary: false,
              },
            ]
          : []),
      ],
    },
    {
      label: "Activité",
      items: [
        {
          to: "/interventions",
          label: "CR chantier",
          short: "CR",
          icon: FileText,
          exact: false,
          primary: true,
        },
        ...(canEdit
          ? [
              {
                to: "/fiches",
                label: "Fiches SST",
                short: "Fiches",
                icon: ClipboardList,
                exact: false,
                primary: false,
              },
              {
                to: "/sst",
                label: "SST",
                short: "SST",
                icon: HardHat,
                exact: false,
                primary: false,
              },
              {
                to: "/journal-sst",
                label: "Journal SST",
                short: "Journal",
                icon: ClipboardList,
                exact: false,
                primary: false,
              },
            ]
          : []),
      ],
    },
    {
      label: "Paramètres",
      items: [
        ...(canEdit
          ? [
              {
                to: "/pilot/controle",
                label: "Centre de contrôle des données",
                short: "Contrôle",
                icon: ShieldCheck,
                exact: false,
                primary: false,
              },
              {
                to: "/pilot/donnees",
                label: "Classeur de données",
                short: "Classeur",
                icon: ClipboardList,
                exact: false,
                primary: false,
              },
              {
                to: "/pilot/sites",
                label: "Sites & contacts",
                short: "Sites",
                icon: MapPin,
                exact: false,
                primary: false,
              },
              {
                to: "/pilot/parametres",
                label: "Règles de calcul",
                short: "Règles",
                icon: Settings2,
                exact: false,
                primary: false,
              },
            ]
          : []),
        {
          to: "/settings",
          label: "Paramètres généraux",
          short: "Réglages",
          icon: Settings,
          exact: false,
          primary: false,
        },
        {
          to: "/personnalisation",
          label: "Personnalisation",
          short: "Apparence",
          icon: Palette,
          exact: false,
          primary: false,
        },
        ...(isAdmin
          ? [
              {
                to: "/versions",
                label: "Version",
                short: "Version",
                icon: History,
                exact: false,
                primary: false,
              },
              {
                to: "/emails",
                label: "Suivi des emails",
                short: "E-mails",
                icon: Mail,
                exact: false,
                primary: false,
              },
              {
                to: "/backend",
                label: "Backend",
                short: "Backend",
                icon: Database,
                exact: false,
                primary: false,
              },
            ]
          : []),
      ],
    },
  ]
    .filter((g) => !appearance.hiddenGroups.includes(g.label))
    .filter((g) => g.items.length > 0 || g.emptyLabel);

  const navItems = groups.flatMap((g) => g.items);
  const primaryItems = navItems.filter((i) => i.primary);
  const moreItems = navItems.filter((i) => !i.primary);

  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.to, i.exact)))?.label;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => navGroupState);
  useEffect(() => {
    if (!activeGroup) return;
    if (navGroupState[activeGroup] === false || navGroupState[activeGroup] === true) return;
    navGroupState = { ...navGroupState, [activeGroup]: true };
    setOpenGroups(navGroupState);
  }, [activeGroup]);
  const defaultOpenGroup = appearance.defaultOpenGroup;
  useEffect(() => {
    if (!defaultOpenGroup) return;
    if (typeof navGroupState[defaultOpenGroup] === "boolean") return;
    navGroupState = { ...navGroupState, [defaultOpenGroup]: true };
    setOpenGroups(navGroupState);
  }, [defaultOpenGroup]);
  const isGroupOpen = (label: string) => openGroups[label] ?? false;
  const toggleGroup = (label: string) => {
    navGroupState = { ...navGroupState, [label]: !(navGroupState[label] ?? false) };
    setOpenGroups(navGroupState);
  };
  const groupIcon: Record<string, typeof LayoutDashboard> = {
    Catalogue: BookOpen,
    Pilotage: Compass,
  };

  return (
    <div data-shell="root" className="min-h-screen bg-secondary/30">
      {/* Sidebar desktop */}
      <TooltipProvider delayDuration={150}>
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-200 md:flex ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <div
            className={`flex items-center gap-2 py-5 ${collapsed ? "flex-col px-2" : "justify-between px-4"}`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src={logo}
                alt="De la graine au jardin"
                className="h-10 w-10 shrink-0 object-contain"
              />
              {!collapsed && (
                <div className="min-w-0 leading-tight">
                  <p className="font-serif text-base font-semibold leading-tight text-primary">
                    {APP_NAME}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Version {APP_VERSION}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && <NotificationBell />}
          </div>
          <div className={collapsed ? "px-2 pb-2" : "px-3 pb-2"}>
            <GlobalSearch collapsed={collapsed} />
          </div>
          <nav
            data-shell="nav"
            className={`flex-1 space-y-4 overflow-y-auto pb-3 ${collapsed ? "px-2" : "px-3"}`}
          >
            {...[]}
          </nav>
        </aside>
      </TooltipProvider>
      <main className={collapsed ? "md:pl-16" : "md:pl-60"}>
        {title && <h1 className="sr-only">{title}</h1>}
        {children}
      </main>
      <InstallPrompt />
      <DirecteurIA />
    </div>
  );
}
