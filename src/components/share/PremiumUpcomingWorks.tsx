import { useMemo, useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SharedPremiumWorkCalendarItem } from "@/lib/share.functions";
import { upcomingWorks, workTasks, workYears } from "@/lib/upcoming-works";

function monthName(item: SharedPremiumWorkCalendarItem) {
  if (item.month == null) return "Date à confirmer";
  return new Date(2000, item.month - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
}

/** Travaux prévus (issus du calendrier travaux), présentés à part des interventions réalisées. */
export function PremiumUpcomingWorks({ items }: { items: SharedPremiumWorkCalendarItem[] }) {
  const upcoming = useMemo(() => upcomingWorks(items), [items]);
  const years = useMemo(() => workYears(upcoming), [upcoming]);
  const [year, setYear] = useState("all");
  if (upcoming.length === 0) return null;

  const shown =
    year === "all"
      ? upcoming
      : upcoming.filter((i) => (i.year ?? new Date().getFullYear()) === Number(year));

  return (
    <section
      aria-label="Travaux à venir"
      className="mt-8 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" strokeWidth={1.6} />
          <h3 className="font-premium-serif text-2xl font-medium">Travaux à venir</h3>
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">
            Prévu
          </span>
        </div>
        {years.length > 1 && (
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-36 bg-background" aria-label="Année des travaux à venir">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes années</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {shown.map((item) => {
          const tasks = workTasks(item);
          return (
            <li key={item.id} className="rounded-xl border border-primary/20 bg-background p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-primary">
                {monthName(item)}
                {item.year ? ` ${item.year}` : ""}
              </p>
              <p className="mt-1 font-premium-serif text-xl font-medium leading-tight">
                {item.title}
              </p>
              {tasks.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {tasks.map((task) => (
                    <li key={task} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
