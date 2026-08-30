import { execFileSync } from "node:child_process";

const head = process.env.HEAD_SHA || "HEAD";

// A PR may contain pre-existing lint debt. Each commit is validated only on
// the files it actually changes, so unrelated old files cannot block a new
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
  .filter((file) => /\.(cjs|js|jsx|mjs|ts|tsx)$/.test(file));

if (supported.length === 0) {
  console.log("No changed code files in this commit to lint.");
  process.exit(0);
}

execFileSync("bunx", ["eslint", ...supported], {
  encoding: "utf8",
  stdio: "inherit",
});
