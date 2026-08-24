// Helpers de dates partagés (Pilot Pro & app).
export const DAY_MS = 86_400_000;

export function currentYear(): number {
  return new Date().getFullYear();
}

export function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/**
 * Premier jour de la semaine (1 = lundi, comportement historique).
 * Réglage d'apparence uniquement : la valeur par défaut ne change rien.
 */
let weekStartDay: 0 | 1 = 1;
export function setWeekStartDay(day: 0 | 1) {
  weekStartDay = day;
}
export function getWeekStartDay(): 0 | 1 {
  return weekStartDay;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() - weekStartDay + 7) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}