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

  // La rubrique de la page courante reste dépliée jusqu'à fermeture manuelle
  // ou rechargement complet de la page.
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.to, i.exact)))?.label;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => navGroupState);
  useEffect(() => {
    if (!activeGroup) return;
    if (navGroupState[activeGroup] === false || navGroupState[activeGroup] === true) return;
    navGroupState = { ...navGroupState, [activeGroup]: true };
    setOpenGroups(navGroupState);
  }, [activeGroup]);
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
            {groups.map((group) => (
              <div key={group.label} data-nav-group={group.label} className="space-y-1">
                {collapsed ? (
                  <div className="mx-2 my-1 border-t border-border/60" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    data-shell="nav-group-title"
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isGroupOpen(group.label) ? "" : "-rotate-90"}`}
                    />
                  </button>
                )}
                {(collapsed || isGroupOpen(group.label)) && (
                  <div className="space-y-1">
                    {group.items.map((item) =>
                      collapsed ? (
                        <Tooltip key={item.to}>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.to}
                              className={`flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                                isActive(item.to, item.exact)
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                              }`}
                            >
                              <item.icon className="h-5 w-5" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive(item.to, item.exact)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Link>
                      ),
                    )}
                    {!collapsed && group.items.length === 0 && group.emptyLabel && (
                      <p className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/60">
                        {(() => {
                          const Icon = groupIcon[group.label];
                          return Icon ? <Icon className="h-5 w-5" /> : null;
                        })()}
                        {group.emptyLabel}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <button
              onClick={toggleCollapsed}
              className={`mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground ${
                collapsed ? "justify-center" : ""
              }`}
              title={collapsed ? "Déplier le menu" : "Replier le menu"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
              {!collapsed && <span>Replier</span>}
            </button>
            {!collapsed ? (
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                <button
                  onClick={signOut}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Déconnexion"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signOut}
                className="flex w-full justify-center rounded-lg p-2 text-muted-foreground hover:text-destructive"
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </aside>
      </TooltipProvider>

      {/* Main */}
      <div className={`transition-[padding] duration-200 ${collapsed ? "md:pl-16" : "md:pl-60"}`}>
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={logo}
              alt="De la graine au jardin"
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="truncate font-serif text-base font-semibold text-primary">
              {title ?? `${APP_NAME} v${APP_VERSION}`}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <GlobalSearch collapsed />
            {isPilot && <PilotPeriodSwitcher compact />}
            {isPilot && <PilotYearSwitcher compact />}
            <NotificationBell />
            <button onClick={signOut} className="text-muted-foreground" title="Déconnexion">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {title && (
          <div
            data-shell="page-header"
            className="hidden px-6 pt-6 md:flex md:items-start md:justify-between md:gap-4"
          >
            <h1 className="font-serif text-2xl font-semibold">{title}</h1>
            {isPilot && (
              <div className="flex items-center gap-2">
                <PilotPeriodSwitcher />
                <PilotYearSwitcher />
              </div>
            )}
          </div>
        )}

        <main data-shell="main" className="px-4 pb-28 pt-4 md:px-6 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around gap-0.5 border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur md:hidden">
        {primaryItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-medium ${
              isActive(item.to, item.exact) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="max-w-full truncate">{item.short}</span>
          </Link>
        ))}
        {moreItems.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <button
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-medium ${
                  moreItems.some((i) => isActive(i.to, i.exact))
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <MoreHorizontal className="h-5 w-5 shrink-0" />
                <span>Plus</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle className="font-serif">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-2 space-y-4 pb-[env(safe-area-inset-bottom)]">
                {groups
                  .map((g) => ({
                    label: g.label,
                    emptyLabel: g.emptyLabel,
                    items: g.items.filter((i) => !i.primary),
                  }))
                  .filter((g) => g.items.length > 0 || g.emptyLabel)
                  .map((group) => (
                    <div key={group.label} className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                        {group.label}
                      </p>
                      {group.items.length === 0 && group.emptyLabel ? (
                        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground/60">
                          {group.emptyLabel}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {group.items.map((item) => (
                            <SheetClose asChild key={item.to}>
                              <Link
                                to={item.to}
                                className={`flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium ${
                                  isActive(item.to, item.exact)
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground"
                                }`}
                              >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            </SheetClose>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </nav>
      <InstallPrompt />
    </div>
  );
}

/**
 * Palette de commande : filtre les liens déjà présents dans la sidebar,
 * navigation aux flèches, validation à Entrée, fermeture à Échap.
 * Aucun lien ajouté ni destination modifiée : la liste vient de la sidebar.
 */
export function NavCommandPalette({
  items,
  open,
  onOpenChange,
  onNavigate,
}: {
  items: { to: string; label: string; short: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate: (to: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const results = filterNavItems(items, query);

  useEffect(() => {
    setIndex(0);
  }, [query]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = results[index];
      if (target) {
        onOpenChange(false);
        onNavigate(target.to);
      }
    }
  };

  return (
    <div
      data-nav-palette="root"
      role="dialog"
      aria-label="Palette de commande"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={() => onOpenChange(false)}
      onKeyDown={onKeyDown}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          aria-label="Rechercher un écran"
          placeholder="Aller à…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Aucun écran.</li>
          )}
          {results.map((item, i) => (
            <li key={item.to}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                data-nav-palette-item={item.to}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  onOpenChange(false);
                  onNavigate(item.to);
                }}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === index ? "bg-accent/50 text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground/70">{item.to}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Exercice partagé : tous les écrans Pilot Pro suivent cette sélection. */
function PilotYearSwitcher({ compact = false }: { compact?: boolean }) {
  const { year, setYear } = usePilotYear();
  const now = new Date().getFullYear();
  const years = Array.from({ length: now - 2019 + 1 }, (_, i) => now + 1 - i);
  return (
    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
      <SelectTrigger
        className={compact ? "h-8 w-[76px] text-xs" : "h-9 w-[104px]"}
        title="Exercice affiché dans tout Pilot Pro"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Périmètre temporel partagé : « À date » (défaut, arrêté à aujourd'hui) ou
 * « Exercice complet », choix explicite et visible de l'utilisateur.
 */
function PilotPeriodSwitcher({ compact = false }: { compact?: boolean }) {
  const { period, setPeriod } = usePilotPeriod();
  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodMode)}>
      <SelectTrigger
        className={compact ? "h-8 w-[104px] text-xs" : "h-9 w-[164px]"}
        title="Périmètre de lecture : arrêté à aujourd'hui ou exercice complet"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a_date">{PERIOD_LABELS.a_date}</SelectItem>
        <SelectItem value="exercice_complet">{PERIOD_LABELS.exercice_complet}</SelectItem>
      </SelectContent>
    </Select>
  );
}
