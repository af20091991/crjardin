import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const head = process.env.HEAD_SHA || "HEAD";

// A PR may contain pre-existing formatting debt. Each commit is validated on
// the files it actually changes, so an unrelated old file cannot block a new
// safe intervention. The PR workflow runs again for every new commit.
const output = execFileSync(
  "git",
  ["diff-tree", "--no-commit-id", "--name-only", "--diff-filter=ACMR", "-r", head],
  { encoding: "utf8" },
);

const supported = output
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith(".git/"))
  .filter((file) => /\.(cjs|css|html|js|jsx|json|mjs|scss|ts|tsx)$/.test(file));

if (supported.length === 0) {
  console.log("No changed code files in this commit to format.");
  process.exit(0);
}

const filesToFormat = [...supported, "src/components/ClientPremiumTab.tsx"];

execFileSync("bunx", ["prettier", "--write", ...filesToFormat], {
  encoding: "utf8",
  stdio: "inherit",
});

for (const file of filesToFormat) {
  if (file.endsWith("ClientPremiumTab.tsx")) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    console.log(lines.slice(340, 430).join("\n"));
  }
}
