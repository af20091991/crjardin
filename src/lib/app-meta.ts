import { CHANGELOG } from "@/lib/changelog";

/** Nom court de l'application affiché dans le menu et le titre. */
export const APP_NAME = "Pilot Pro";

/** Version actuelle = version de l'entrée la plus récente du changelog. */
export const APP_VERSION = CHANGELOG[0]?.version ?? "1.0.0";

/** Libellé prêt à l'emploi : « CR Pro v1.11.0 ». */
export const APP_NAME_VERSION = `${APP_NAME} v${APP_VERSION}`;

/**
 * Temps total passé à développer l'application (toutes tâches confondues), en heures.
 * Estimation calculée à partir de l'historique git (sessions = commits espacés de moins de 2 h,
 * +30 min par session). À mettre à jour périodiquement.
 */
export const DEV_HOURS_ESTIMATE = 359;
