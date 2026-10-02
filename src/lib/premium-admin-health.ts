export type PremiumAlertLevel = "warning" | "info";

export interface PremiumAlert {
  code: "no_calendar" | "calendar_over" | "no_cover" | "no_report";
  level: PremiumAlertLevel;
  label: string;
}

export interface PremiumHealthInput {
  calendar: Array<{ year: number | null; month: number | null }>;
  coverPhotoId: string | null;
  lastReportSentAt: string | null;
}

const REPORT_STALE_DAYS = 90;

/** Contrôle de complétude d'une fiche Premium : ce qui manque pour que l'espace soit soigné. */
export function computePremiumAlerts(input: PremiumHealthInput, now = new Date()): PremiumAlert[] {
  const alerts: PremiumAlert[] = [];

  if (input.calendar.length === 0) {
    alerts.push({ code: "no_calendar", level: "warning", label: "Calendrier travaux non importé" });
  } else {
    const currentKey = now.getFullYear() * 12 + (now.getMonth() + 1);
    const hasUpcoming = input.calendar.some((item) => {
      if (item.month == null) return true;
      return (item.year ?? now.getFullYear()) * 12 + item.month >= currentKey;
    });
    if (!hasUpcoming) {
      alerts.push({
        code: "calendar_over",
        level: "warning",
        label: "Calendrier terminé : plus aucune intervention à venir",
      });
    }
  }

  if (!input.coverPhotoId) {
    alerts.push({ code: "no_cover", level: "info", label: "Pas de photo de couverture" });
  }

  if (!input.lastReportSentAt) {
    alerts.push({ code: "no_report", level: "warning", label: "Aucun compte-rendu envoyé" });
  } else {
    const days = Math.floor(
      (now.getTime() - new Date(input.lastReportSentAt).getTime()) / 86_400_000,
    );
    if (days > REPORT_STALE_DAYS) {
      alerts.push({
        code: "no_report",
        level: "info",
        label: `Dernier compte-rendu envoyé il y a ${days} jours`,
      });
    }
  }

  return alerts;
}

/** Les détails d'une intervention sont stockés « tâche · tâche » ; l'édition se fait une tâche par ligne. */
export function detailsToLines(details: string | null): string {
  return (details ?? "")
    .split(" · ")
    .map((task) => task.trim())
    .filter(Boolean)
    .join("\n");
}

export function linesToDetails(lines: string): string | null {
  const joined = lines
    .split("\n")
    .map((task) => task.trim())
    .filter(Boolean)
    .join(" · ");
  return joined || null;
}

export type PremiumAlertFix =
  | { kind: "calendars"; label: string }
  | { kind: "client"; tab: "interventions" | "premium"; label: string };

/** Page qui permet de résoudre chaque alerte. */
export function alertFix(code: PremiumAlert["code"]): PremiumAlertFix {
  switch (code) {
    case "no_calendar":
      return { kind: "client", tab: "premium", label: "Importer le calendrier PDF" };
    case "calendar_over":
      return { kind: "calendars", label: "Ajouter des interventions" };
    case "no_cover":
      return { kind: "client", tab: "premium", label: "Choisir la photo de couverture" };
    case "no_report":
      return { kind: "client", tab: "interventions", label: "Envoyer un compte-rendu" };
  }
}
