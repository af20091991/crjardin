import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Users, Plus, LogOut, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/clients", label: "Clients", icon: Users, exact: false },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src={logo} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
          <span className="font-serif text-lg font-semibold">Jardin Pro</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.to, item.exact)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4.5 w-4.5" />
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
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-serif text-base font-semibold">{title ?? "Jardin Pro"}</span>
          </div>
          <button onClick={signOut} className="text-muted-foreground" title="Déconnexion">
            <LogOut className="h-5 w-5" />
          </button>
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
        {NAV.map((item) => (
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