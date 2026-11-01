import { CHANGELOG } from "@/lib/changelog";

/** Nom court de l'application affiché dans le menu et le titre. */
export const APP_NAME = "Pilot Pro";

/** Version actuelle = version de l'entrée la plus récente du changelog. */
export const APP_VERSION = CHANGELOG[0]?.version ?? "1.0.0";

/** Libellé prêt à l'emploi : « CR Pro v1.11.0 ». */
export const APP_NAME_VERSION = `${APP_NAME} v${APP_VERSION}`;

/**
 * Temps total passé à développer l'application (toutes tâches confondues), en heures.
 * Estimation : union de trois sources horodatées (messages Lovable, commits git, journal de
 * session), regroupées en sessions (écart max 60 min, +10 min avant et après chaque session),
 * puis ventilées par jour (fuseau Europe/Paris). Hors temps de réflexion sans trace écrite.
 */
export const DEV_HOURS_ESTIMATE = 298;
