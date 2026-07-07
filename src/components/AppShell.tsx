import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { useRole } from "@/hooks/use-role";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LayoutDashboard, Users, Plus, LogOut, Settings, Shield, CalendarDays, BarChart3, History, Mail, MoreHorizontal, ClipboardList, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";

type NavItem = {
  to: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  primary: boolean;
};
type NavGroup = { label: string; items: NavItem[] };

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canEdit } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const groups: NavGroup[] = [
    {
      label: "CR Pro",
      items: [
        { to: "/", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard, exact: true, primary: true },
        { to: "/planning", label: "Planning", short: "Planning", icon: CalendarDays, exact: false, primary: true },
        { to: "/clients", label: "Clients", short: "Clients", icon: Users, exact: false, primary: true },
        { to: "/statistiques", label: "Statistiques", short: "Stats", icon: BarChart3, exact: false, primary: true },
        ...(isAdmin
          ? [{ to: "/emails", label: "Suivi des emails", short: "E-mails", icon: Mail, exact: false, primary: false }]
          : []),
      ],
    },
    {
      label: "SST Pro",
      items: canEdit
        ? [{ to: "/fiches", label: "Fiches SST", short: "SST", icon: ClipboardList, exact: false, primary: false }]
        : [],
    },
    {
      label: "Fiches CR Pro",
      items: [
        ...(canEdit
          ? [{ to: "/interventions", label: "Fiches CR", short: "CR", icon: FileText, exact: false, primary: false }]
          : []),
        { to: "/settings", label: "Profil & signature", short: "Profil", icon: Settings, exact: false, primary: false },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: "Administration",
            items: [
              { to: "/admin", label: "Administration", short: "Admin", icon: Shield, exact: false, primary: false },
              { to: "/versions", label: "Versions", short: "Versions", icon: History, exact: false, primary: false },
            ],
          },
        ]
      : []),
  ].filter((g) => g.items.length > 0);

  const navItems = groups.flatMap((g) => g.items);
  const primaryItems = navItems.filter((i) => i.primary);
  const moreItems = navItems.filter((i) => !i.primary);

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center justify-between gap-2 px-4 py-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src={logo} alt="De la graine au jardin" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="font-serif text-base font-semibold leading-tight text-primary">{APP_NAME}</p>
              <p className="truncate text-[11px] text-muted-foreground">Version {APP_VERSION}</p>
            </div>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map((item) => (
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
              ))}
              {group.label === "Fiches CR Pro" && canEdit && (
                <Link
                  to="/interventions/new"
                  className="mt-1 flex items-center gap-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-5 w-5" /> Nouveau compte-rendu
                </Link>
              )}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            <button onClick={signOut} className="shrink-0 text-muted-foreground hover:text-destructive" title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="md:pl-60">
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
        {canEdit && (
          <Link
            to="/interventions/new"
            aria-label="Nouveau compte-rendu"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-medium text-primary"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow">
              <Plus className="h-5 w-5" />
            </div>
          </Link>
        )}
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
                  .map((g) => ({ label: g.label, items: g.items.filter((i) => !i.primary) }))
                  .filter((g) => g.items.length > 0)
                  .map((group) => (
                    <div key={group.label} className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                        {group.label}
                      </p>
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