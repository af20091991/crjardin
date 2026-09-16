import type { MonthNature } from "@/lib/pilot-ca-months";

/**
 * Returns the presentation tone for the annual month timeline.
 * The active month always wins over the beneficiary/loss background.
 */
export function monthResultTone(resultat: number, nature: MonthNature, active: boolean): string {
  if (active) return "bg-emerald-700 text-white";
  if (nature === "aucun") return "bg-muted text-muted-foreground";
  return resultat >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800";
}
