import type { MonthNature } from "@/lib/pilot-ca-months";

/**
 * Returns the presentation tone for the annual month timeline.
 * The active month always wins over the beneficiary/loss background.
 */
export function monthResultTone(resultat: number, nature: MonthNature, active: boolean): string {
  if (active) return "bg-[#4F8E33] text-white";
  if (nature === "aucun") return "bg-muted text-muted-foreground";
  return resultat >= 0
    ? "bg-[color-mix(in_oklab,#4AAC33_18%,transparent)] text-[#4F8E33]"
    : "bg-[color-mix(in_oklab,#EE8627_18%,transparent)] text-[#EE8627]";
}
