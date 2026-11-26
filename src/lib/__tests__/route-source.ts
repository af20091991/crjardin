import { existsSync, readFileSync } from "node:fs";

/**
 * Source d'une route pour les tests de contenu : le fichier de route, plus son composant
 * de page lorsqu'il est chargé à la demande (src/route-components/…).
 */
export function readRouteSource(routeFile: string): string {
  const componentFile = routeFile.replace("src/routes/", "src/route-components/");
  const route = readFileSync(routeFile, "utf8");
  return existsSync(componentFile) ? route + "\n" + readFileSync(componentFile, "utf8") : route;
}
