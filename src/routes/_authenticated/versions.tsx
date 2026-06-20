import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { CHANGELOG, THEME_LABELS, type ChangeEntry, type ChangeTheme } from "@/lib/changelog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCommitVertical, CalendarDays, Tags, ListOrdered, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/versions")({
  head: () => ({ meta: [{ title: "Versions — De la graine au jardin" }] }),
  component: VersionsPage,
});

type SortMode = "chrono" | "date" | "theme";

const THEME_STYLES: Record<ChangeTheme, string> = {
  Marque: "bg-accent/15 text-accent-foreground border-accent/30",
  Clients: "bg-primary/10 text-primary border-primary/20",
  "Compte-rendus": "bg-primary/10 text-primary border-primary/20",
  "PDF & Partage": "bg-accent/15 text-accent-foreground border-accent/30",
  Jardinier: "bg-secondary text-secondary-foreground border-border",
  Général: "bg-muted text-muted-foreground border-border",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function EntryCard({ entry }: { entry: ChangeEntry }) {
  return (
    <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">v{entry.version}</Badge>
          <Badge variant="outline" className={THEME_STYLES[entry.theme]}>{entry.theme}</Badge>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(entry.date)}
          </span>
        </div>
        <h3 className="mt-2 font-serif text-lg font-semibold">{entry.title}</h3>
        <ul className="mt-2 space-y-1.5">
          {entry.details.map((d, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function VersionsPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortMode>("chrono");

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const grouped = useMemo(() => {
    if (sort === "chrono") {
      return [{ key: "Toutes les évolutions", entries: CHANGELOG }];
    }
    if (sort === "date") {
      const byDate = new Map<string, ChangeEntry[]>();
      for (const e of CHANGELOG) {
        const arr = byDate.get(e.date) ?? [];
        arr.push(e);
        byDate.set(e.date, arr);
      }
      return Array.from(byDate.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, entries]) => ({ key: formatDate(date), entries }));
    }
    // theme
    return THEME_LABELS.map((theme) => ({
      key: theme,
      entries: CHANGELOG.filter((e) => e.theme === theme),
    })).filter((g) => g.entries.length > 0);
  }, [sort]);

  if (isLoading || !isAdmin) {
    return (
      <AppShell title="Versions">
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const sortButtons: { mode: SortMode; label: string; icon: typeof CalendarDays }[] = [
    { mode: "chrono", label: "Chronologique", icon: ListOrdered },
    { mode: "date", label: "Par date", icon: CalendarDays },
    { mode: "theme", label: "Par thématique", icon: Tags },
  ];

  return (
    <AppShell title="Versions">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <GitCommitVertical className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold">Historique des versions</h2>
              <p className="text-sm text-muted-foreground">
                Toutes les évolutions appliquées jusqu'à la version actuelle.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {sortButtons.map((b) => (
            <Button
              key={b.mode}
              variant={sort === b.mode ? "default" : "outline"}
              size="sm"
              onClick={() => setSort(b.mode)}
            >
              <b.icon className="mr-1.5 h-4 w-4" /> {b.label}
            </Button>
          ))}
        </div>

        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-3">
              {sort !== "chrono" && (
                <h3 className="sticky top-16 z-10 -mx-1 bg-secondary/30 px-1 py-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {group.key}
                </h3>
              )}
              <div className="relative space-y-3 border-l-2 border-border/60 pl-4 md:pl-5">
                {group.entries.map((entry, i) => (
                  <div key={`${entry.version}-${i}`} className="relative">
                    <span className="absolute -left-[1.45rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary md:-left-[1.7rem]" />
                    <EntryCard entry={entry} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}