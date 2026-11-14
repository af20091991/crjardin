// Pré-devis : mise en page commune à l'import et au devis enregistré (maquette v3).
// Barre haute, bandeau des totaux collant, étapes à gauche, contenu au centre, aide à droite.
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export type StepState = "done" | "current" | "locked";
export type PredevisStep = { label: string; hint: string; state: StepState };

export function PredevisShell({
  crumbs,
  status,
  actions,
  totals,
  steps,
  aside,
  children,
}: {
  crumbs: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  totals?: ReactNode;
  steps: PredevisStep[];
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <nav
          className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
          aria-label="Fil d'Ariane"
        >
          {crumbs}
          {status && <Badge variant="outline">{status}</Badge>}
        </nav>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {totals}

      <div className="grid gap-5 pt-5 lg:grid-cols-[200px_minmax(0,1fr)_260px]">
        <aside className="flex gap-3 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className={`relative flex min-w-[180px] items-start gap-3 rounded-xl p-3 transition-colors lg:min-w-0 ${
                s.state === "current"
                  ? "bg-card shadow-sm ring-1 ring-primary/30"
                  : "hover:bg-muted/40"
              } ${s.state === "locked" ? "opacity-50" : ""}`}
              aria-current={s.state === "current" ? "step" : undefined}
            >
              <span
                className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${
                  s.state === "done"
                    ? "bg-primary text-primary-foreground"
                    : s.state === "current"
                      ? "bg-primary/15 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.state === "done" ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              </div>
            </div>
          ))}
        </aside>

        <main className="min-w-0 space-y-5">{children}</main>

        {aside && <aside className="min-w-0 space-y-4">{aside}</aside>}
      </div>
    </div>
  );
}

/** Carte latérale : titre discret et contenu. */
export function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}
