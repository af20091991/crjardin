import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Lovable déploie le dossier dist/ ; nitro (preset node-server) écrit le client
// dans .output/public et le serveur dans .output/server. On copie le client dans
// dist/ pour satisfaire le contrôle de déploiement sans modifier la sortie nitro,
// que le déploiement O2switch (.github/workflows/deploy-o2switch.yml) téléverse
// tel quel depuis .output/.
const root = process.cwd();
const client = join(root, ".output", "public");
const dist = join(root, "dist");

if (!existsSync(client)) {
  console.error("[post-build] .output/public introuvable : lancez « bun run build » d'abord.");
  process.exit(1);
}

mkdirSync(dist, { recursive: true });
cpSync(client, dist, { recursive: true });
console.log("[post-build] client copié dans dist/");
