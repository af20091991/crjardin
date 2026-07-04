import { CHANGELOG } from "@/lib/changelog";

/** Nom court de l'application affiché dans le menu et le titre. */
export const APP_NAME = "CR Pro";

/** Version actuelle = version de l'entrée la plus récente du changelog. */
export const APP_VERSION = CHANGELOG[0]?.version ?? "1.0.0";

/** Libellé prêt à l'emploi : « CR Pro v1.11.0 ». */
export const APP_NAME_VERSION = `${APP_NAME} v${APP_VERSION}`;
