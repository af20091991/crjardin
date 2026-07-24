import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { useRole } from "@/hooks/use-role";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LayoutDashboard, Users, LogOut, Settings, CalendarDays, BarChart3, History, Mail, MoreHorizontal, ClipboardList, FileText, ChevronDown, Database, BookOpen, Compass, Palette, PanelLeftClose, PanelLeftOpen, HardHat, Home, Euro, Target, Calculator, CalendarRange, FileBarChart, Link2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";
import { useAppearance } from "@/lib/appearance";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  to: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  primary: boolean;
};
type NavGroup = { label: string; items: NavItem[]; emptyLabel?: string };

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canEdit } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { appearance } = useAppearance();

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

  const groups: NavGroup[] = [
    {
      label: "Aujourd'hui",
      items: [
        { to: "/", label: "Aujourd'hui", short: "Accueil", icon: Home, exact: true, primary: true },
      ],
    },
    {
      label: "Clients",
      items: [
        { to: "/clients", label: "Clients", short: "Clients", icon: Users, exact: false, primary: true },
      ],
    },
    {
      label: "Pilot Pro",
      items: canEdit
        ? [
            { to: "/pilot", label: "Vue d'ensemble", short: "Pilot", icon: Compass, exact: true, primary: true },
            { to: "/pilot/direction", label: "Direction", short: "Direction", icon: BarChart3, exact: false, primary: false },
            { to: "/pilot/ca", label: "CA", short: "CA", icon: Euro, exact: false, primary: false },
            { to: "/pilot/objectifs", label: "Objectifs", short: "Objectifs", icon: Target, exact: false, primary: false },
            { to: "/pilot/finance", label: "Finance", short: "Finance", icon: Calculator, exact: false, primary: false },
            { to: "/pilot/clients", label: "Rentabilité", short: "Rentab.", icon: Users, exact: false, primary: false },
            { to: "/pilot/saison", label: "Prévisions", short: "Prévis.", icon: CalendarRange, exact: false, primary: false },
            { to: "/pilot/rapports", label: "Rapports", short: "Rapports", icon: FileBarChart, exact: false, primary: false },
            { to: "/pilot/rapprochement", label: "Rapprochement CA", short: "Rappr.", icon: Link2, exact: false, primary: false },
            { to: "/statistiques", label: "Statistiques", short: "Stats", icon: BarChart3, exact: false, primary: false },
          ]
        : [],
      emptyLabel: canEdit ? undefined : "Réservé",
    },
    {
      label: "CR Chantier",
      items: canEdit
        ? [
            { to: "/interventions", label: "Comptes-rendus", short: "CR", icon: FileText, exact: false, primary: false },
          ]
        : [],
      emptyLabel: canEdit ? undefined : "Réservé",
    },
    {
      label: "SST Pro",
      items: canEdit
        ? [
            { to: "/sst", label: "Sous-traitants", short: "SST", icon: HardHat, exact: false, primary: false },
            { to: "/fiches", label: "Fiches SST", short: "Fiches", icon: ClipboardList, exact: false, primary: false },
          ]
        : [],
      emptyLabel: canEdit ? undefined : "Bientôt disponible",
    },
    { label: "Catalogue", items: [], emptyLabel: "Bientôt disponible" },
    {
      label: "Planning",
      items: [
        { to: "/planning", label: "Planning", short: "Planning", icon: CalendarDays, exact: false, primary: true },
      ],
    },
    {
      label: "Paramètres",
      items: [
        { to: "/settings", label: "Réglages", short: "Réglages", icon: Settings, exact: false, primary: false },
        { to: "/personnalisation", label: "Personnalisation", short: "Apparence", icon: Palette, exact: false, primary: false },
        ...(isAdmin
          ? [
              { to: "/versions", label: "Version", short: "Version", icon: History, exact: false, primary: false },
              { to: "/emails", label: "Suivi des emails", short: "E-mails", icon: Mail, exact: false, primary: false },
              { to: "/backend", label: "Backend", short: "Backend", icon: Database, exact: false, primary: false },
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

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isGroupOpen = (label: string) => openGroups[label] ?? true;
  const toggleGroup = (label: string) =>
    setOpenGroups((s) => ({ ...s, [label]: !(s[label] ?? true) }));
  const groupIcon: Record<string, typeof LayoutDashboard> = {
    "Catalogue": BookOpen,
    "Pilot Pro": Compass,
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Sidebar desktop */}
      <TooltipProvider delayDuration={150}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-200 md:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className={`flex items-center gap-2 py-5 ${collapsed ? "flex-col px-2" : "justify-between px-4"}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <img src={logo} alt="De la graine au jardin" className="h-10 w-10 shrink-0 object-contain" />
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <p className="font-serif text-base font-semibold leading-tight text-primary">{APP_NAME}</p>
                <p className="truncate text-[11px] text-muted-foreground">Version {APP_VERSION}</p>
              </div>
            )}
          </div>
          {!collapsed && <NotificationBell />}
        </div>
        <nav className={`flex-1 space-y-4 overflow-y-auto pb-3 ${collapsed ? "px-2" : "px-3"}`}>
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              {collapsed ? (
                <div className="mx-2 my-1 border-t border-border/60" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
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
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!collapsed && <span>Replier</span>}
          </button>
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              <button onClick={signOut} className="shrink-0 text-muted-foreground hover:text-destructive" title="Déconnexion">
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
            <img src={logo} alt="De la graine au jardin" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate font-serif text-base font-semibold text-primary">{title ?? `${APP_NAME} v${APP_VERSION}`}</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <button onClick={signOut} className="text-muted-foreground" title="Déconnexion">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {title && (
          <div className="hidden px-6 pt-6 md:block">
            <h1 className="font-serif text-2xl font-semibold">{title}</h1>
          </div>
        )}

        <main className="px-4 pb-28 pt-4 md:px-6 md:pb-10">{children}</main>
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
                  moreItems.some((i) => isActive(i.to, i.exact)) ? "text-primary" : "text-muted-foreground"
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
                  .map((g) => ({ label: g.label, emptyLabel: g.emptyLabel, items: g.items.filter((i) => !i.primary) }))
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
                                isActive(item.to, item.exact) ? "bg-primary/10 text-primary" : "text-foreground"
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