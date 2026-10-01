import { CalendarDays, ChevronDown } from "lucide-react";
import type { SharedPremiumWorkCalendarItem } from "@/lib/share.functions";

function periodLabel(item: SharedPremiumWorkCalendarItem) {
  return (
    item.period_label ||
    (item.month
      ? new Date(2000, item.month - 1, 1).toLocaleDateString("fr-FR", { month: "long" })
      : "À venir")
  );
}

export function PremiumWorkCalendar({
  items,
  editorial = false,
}: {
  items: SharedPremiumWorkCalendarItem[];
  editorial?: boolean;
}) {
  const currentKey = new Date().getFullYear() * 12 + (new Date().getMonth() + 1);
  const upcomingItems = items.filter((item) => {
    if (item.year == null || item.month == null) return true;
    return item.year * 12 + item.month >= currentKey;
  });

  if (upcomingItems.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <CalendarDays className="mx-auto size-8 text-primary/60" strokeWidth={1.4} />
        <p className="mt-3 font-premium-serif text-2xl">Votre calendrier travaux</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Le calendrier des travaux apparaîtra ici dès que son document aura été associé à votre
          Compte Premium.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      {upcomingItems.map((item, index) => (
        <details
          key={item.id}
          open={index === 0}
          className={
            editorial
              ? "group border-b py-1"
              : "group overflow-hidden rounded-2xl border bg-background"
          }
        >
          <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 [&::-webkit-details-marker]:hidden">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="size-5" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-[0.14em] text-primary">
                {periodLabel(item)}
              </span>
              <span className="mt-1 block font-premium-serif text-2xl font-medium leading-tight sm:text-3xl">
                {item.title}
              </span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t px-5 pb-6 pt-4 pl-[4.5rem]">
            {item.details ? (
              <ul className="max-w-3xl space-y-2 text-sm leading-7 text-muted-foreground">
                {item.details
                  .split(" · ")
                  .map((task) => task.trim())
                  .filter(Boolean)
                  .map((task) => (
                    <li key={task} className="flex gap-3">
                      <span
                        className="mt-3 size-1.5 shrink-0 rounded-full bg-primary/60"
                        aria-hidden="true"
                      />
                      <span>{task}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Détails à préciser.</p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
