const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const outDir = join(__dirname, "..", "node_modules", ".tmp", "recurrence-tests");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "package.json"), JSON.stringify({ type: "commonjs" }));

const tscBin = join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
const tsc = spawnSync(tscBin, ["-p", "tsconfig.recurrence-test.json"], {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

const testFile = join(outDir, "tests", "recurrence.test.js");
if (!existsSync(testFile)) {
  console.error(`Compiled test file not found: ${testFile}`);
  process.exit(1);
}

const nodeTest = spawnSync(process.execPath, [testFile], {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
});

process.exit(nodeTest.status ?? 1);
