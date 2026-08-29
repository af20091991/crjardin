import { execFileSync } from "node:child_process";

const protectedPaths = [
  "src/routeTree.gen.ts",
  "src/integrations/supabase/client.ts",
  "src/integrations/supabase/client.server.ts",
  "src/integrations/supabase/types.ts",
  "src/integrations/supabase/auth-middleware.ts",
  "src/integrations/supabase/auth-attacher.ts",
  "src/integrations/supabase/previewAuthStorage.ts",
  ".env",
  "supabase/config.toml",
];

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA || "HEAD";

if (!base) {
  console.log("Protected-file check skipped: no BASE_SHA supplied.");
  process.exit(0);
}

const changed = execFileSync("git", ["diff", "--name-only", base, head], {
  encoding: "utf8",
})
  .split("\n")
  .map((path) => path.trim())
  .filter(Boolean);

const violations = changed.filter((path) => protectedPaths.includes(path));

if (violations.length > 0) {
  console.error("Protected files were modified:");
  for (const path of violations) console.error(`- ${path}`);
  console.error("These files are excluded from normal assistant/Lovable modifications.");
  process.exit(1);
}

console.log(`Protected-file check passed (${changed.length} changed file(s)).`);
