import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { NotificationBell } from "@/components/NotificationBell";
import { LayoutDashboard, Users, Plus, LogOut, Settings, Shield, CalendarDays, BarChart3, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/planning", label: "Planning", icon: CalendarDays, exact: false },
  { to: "/clients", label: "Clients", icon: Users, exact: false },
  { to: "/statistiques", label: "Statistiques", icon: BarChart3, exact: false },
  { to: "/settings", label: "Profil & signature", icon: Settings, exact: false },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const navItems = isAdmin
    ? [
        ...NAV,
        { to: "/admin", label: "Administration", icon: Shield, exact: false },
        { to: "/versions", label: "Versions", icon: History, exact: false },
      ]
    : NAV;

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center justify-between gap-2 px-4 py-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src={logo} alt="De la graine au jardin" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="font-serif text-sm font-semibold leading-tight text-primary">De la graine<br />au jardin</p>
              <p className="truncate text-[11px] text-muted-foreground">au rythme de la nature</p>
            </div>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
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
        </nav>
        <div className="border-t border-border p-3">
          <Link
            to="/interventions/new"
            className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Compte-rendu
          </Link>
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
            <span className="truncate font-serif text-base font-semibold text-primary">{title ?? "De la graine au jardin"}</span>
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
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${
              isActive(item.to, item.exact) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <Link
          to="/interventions/new"
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium text-primary"
        >
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow">
            <Plus className="h-5 w-5" />
          </div>
        </Link>
      </nav>
    </div>
  );
}