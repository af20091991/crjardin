// Environnement DOM pour les tests de rendu réel (happy-dom).
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!(globalThis as { document?: unknown }).document) {
  GlobalRegistrator.register();
}
