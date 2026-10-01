import { CalendarDays, ChevronDown } from "lucide-react";
import type { SharedPremiumWorkCalendarItem } from "@/lib/share.functions";
import { pickNextIntervention } from "@/lib/premium-planning-items";

function periodLabel(item: SharedPremiumWorkCalendarItem) {
  return (
    item.period_label ||
    (item.month
      ? new Date(2000, item.month - 1, 1).toLocaleDateString("fr-FR", { month: "long" })
      : "À venir")
  );
}

function itemKey(item: SharedPremiumWorkCalendarItem) {
  return item.month == null ? null : (item.year ?? new Date().getFullYear()) * 12 + item.month;
}

export function PremiumWorkCalendar({
  items,
  editorial = false,
}: {
  items: SharedPremiumWorkCalendarItem[];
  editorial?: boolean;
}) {
  const now = new Date();
  const currentKey = now.getFullYear() * 12 + (now.getMonth() + 1);
  const next = pickNextIntervention(items, now);

  if (items.length === 0) {
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
    <div
      className={
        editorial ? "mt-8 border-t" : "mt-8 overflow-hidden rounded-2xl border bg-background"
      }
    >
      <div className="hidden grid-cols-[11rem_1fr_2.5rem] gap-4 border-b bg-muted/30 px-5 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground sm:grid">
        <span>Période</span>
        <span>Intervention</span>
        <span className="sr-only">Détails</span>
      </div>
      {items.map((item) => {
        const key = itemKey(item);
        const past = key != null && key < currentKey;
        const isNext = next?.id === item.id;
        const tasks = (item.details ?? "")
          .split(" · ")
          .map((task) => task.trim())
          .filter(Boolean);
        return (
          <details
            key={item.id}
            open={isNext}
            className={`group border-b last:border-b-0 ${past ? "opacity-60" : ""} ${
              isNext ? "bg-primary/5" : ""
            }`}
          >
            <summary className="grid cursor-pointer list-none grid-cols-[1fr_2.5rem] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[11rem_1fr_2.5rem] [&::-webkit-details-marker]:hidden">
              <span className="text-xs uppercase tracking-[0.14em] text-primary sm:text-sm">
                {periodLabel(item)}
                {isNext && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] normal-case tracking-normal text-primary-foreground">
                    Prochaine
                  </span>
                )}
              </span>
              <span className="order-3 col-span-1 font-premium-serif text-xl font-medium leading-tight sm:order-none sm:text-2xl">
                {item.title}
              </span>
              <ChevronDown className="row-span-2 size-5 justify-self-end text-muted-foreground transition-transform group-open:rotate-180 sm:row-span-1" />
            </summary>
            <div className="px-5 pb-5 sm:pl-[12.5rem]">
              {tasks.length > 0 ? (
                <ul className="max-w-3xl space-y-2 text-sm leading-7 text-muted-foreground">
                  {tasks.map((task) => (
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
        );
      })}
    </div>
  );
}
