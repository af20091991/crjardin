import { execFileSync } from "node:child_process";

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA || "HEAD";

if (!base || /^0+$/.test(base)) {
  console.log("No usable base commit; skipping changed-file formatting check.");
  process.exit(0);
}

const output = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMR", `${base}...${head}`],
  { encoding: "utf8" },
);

const supported = output
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith(".git/"))
  .filter((file) => /\.(cjs|css|html|js|jsx|json|mjs|scss|ts|tsx)$/.test(file));

if (supported.length === 0) {
  console.log("No changed code files to format.");
  process.exit(0);
}

execFileSync("bunx", ["prettier", "--check", ...supported], {
  encoding: "utf8",
  stdio: "inherit",
});
