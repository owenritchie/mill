import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const staged = path.join(root, "src-tauri", "resources", "standalone");
const incoming = path.join(root, "src-tauri", "resources", ".standalone.incoming");

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

run("node scripts/fetch-node.mjs");

fs.rmSync(incoming, { recursive: true, force: true });
fs.rmSync(standalone, { recursive: true, force: true });

run("npx next build");

fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
fs.cpSync(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);

fs.mkdirSync(incoming, { recursive: true });
run(`cp -RL "${standalone}/." "${incoming}/"`);

const stagedSize = Number(
  execSync(`du -sm "${incoming}" | cut -f1`).toString().trim(),
);
if (stagedSize > 300) {
  throw new Error(
    `Staged server is ${stagedSize}MB, expected well under 300MB. ` +
      `Check that src-tauri is excluded from Next's file tracing.`,
  );
}

fs.copyFileSync(
  path.join(root, "scripts", "desktop-server.mjs"),
  path.join(incoming, "mill-server.mjs"),
);

const links = execSync(`find "${incoming}" -type l | wc -l`).toString().trim();
if (links !== "0") {
  throw new Error(`Staged tree still contains ${links} symlink(s); they will not survive bundling.`);
}

fs.rmSync(staged, { recursive: true, force: true });
fs.renameSync(incoming, staged);

const size = execSync(`du -sh "${staged}"`).toString().trim().split("\t")[0];
console.log(`\nStaged Next server for bundling: ${staged} (${size})`);
