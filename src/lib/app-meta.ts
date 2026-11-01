import { CHANGELOG } from "@/lib/changelog";

/** Nom court de l'application affiché dans le menu et le titre. */
export const APP_NAME = "Pilot Pro";

/** Version actuelle = version de l'entrée la plus récente du changelog. */
export const APP_VERSION = CHANGELOG[0]?.version ?? "1.0.0";

/** Libellé prêt à l'emploi : « CR Pro v1.11.0 ». */
export const APP_NAME_VERSION = `${APP_NAME} v${APP_VERSION}`;

/**
 * Temps total passé à développer l'application (toutes tâches confondues), en heures.
 * Estimation : 5 h par jour depuis le 15/06/2026, 7 j/7 (140 jours à la date du 01/11/2026).
 */
export const DEV_HOURS_ESTIMATE = 695;
