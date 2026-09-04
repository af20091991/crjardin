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

execFileSync("bunx", ["prettier", "--write", ...supported], {
  encoding: "utf8",
  stdio: "inherit",
});

for (const file of supported) {
  console.log(`--- BEGIN PRETTIER ${file} ---`);
  console.log(readFileSync(file, "utf8"));
  console.log(`--- END PRETTIER ${file} ---`);
}
