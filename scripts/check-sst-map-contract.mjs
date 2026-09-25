import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const mapPath = "src/lib/maps.functions.ts";
const contractPath = "src/lib/__tests__/google-static-map-pdf.test.ts";
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA || "HEAD";

if (!existsSync(contractPath)) {
  console.error(`Missing mandatory SST Google Static Maps regression test: ${contractPath}`);
  process.exit(1);
}

if (!base) {
  console.log("SST map contract guard skipped: no BASE_SHA supplied.");
  process.exit(0);
}

const changed = execFileSync("git", ["diff", "--name-only", base, head], {
  encoding: "utf8",
})
  .split("\n")
  .map((path) => path.trim())
  .filter(Boolean);

if (changed.includes(mapPath) && !changed.includes(contractPath)) {
  console.error(
    `${mapPath} changed without updating ${contractPath}. Update the regression contract whenever the PDF map implementation changes.`,
  );
  process.exit(1);
}

console.log("SST Google Static Maps contract guard passed.");
