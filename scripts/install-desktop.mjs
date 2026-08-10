import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const built = path.join(root, "src-tauri/target/release/bundle/macos/Mill.app");
const target = "/Applications/Mill.app";
const staging = "/Applications/.Mill.app.incoming";

if (!fs.existsSync(built)) {
  console.error(`No built app at ${built}. Run \`npm run desktop:build\` first.`);
  process.exit(1);
}

const running = () =>
  spawnSync("pgrep", ["-f", "Mill.app/Contents/MacOS/app"], { encoding: "utf8" })
    .stdout.trim()
    .length > 0;

if (running()) {
  console.log("Mill is running; quitting it first.");
  spawnSync("osascript", ["-e", 'tell application "Mill" to quit']);
  for (let i = 0; i < 20 && running(); i++) {
    spawnSync("sleep", ["0.25"]);
  }
  if (running()) {
    spawnSync("pkill", ["-f", "Mill.app/Contents/MacOS/app"]);
    for (let i = 0; i < 20 && running(); i++) {
      spawnSync("sleep", ["0.25"]);
    }
  }
  if (running()) {
    console.error("Could not quit Mill. Quit it manually and re-run.");
    process.exit(1);
  }
}

const buildIdPath = (root) =>
  path.join(root, "Contents/Resources/standalone/.next/BUILD_ID");

const expected = fs.readFileSync(buildIdPath(built), "utf8").trim();

fs.rmSync(staging, { recursive: true, force: true });
execSync(`ditto "${built}" "${staging}"`, { stdio: "inherit" });

fs.rmSync(target, { recursive: true, force: true });
if (fs.existsSync(target)) {
  console.error(
    `Could not remove ${target}. Quit Mill, or grant your terminal App Management ` +
      `permission in System Settings > Privacy & Security.`,
  );
  process.exit(1);
}

fs.renameSync(staging, target);
execSync(`xattr -cr "${target}"`);

const installed = fs.existsSync(buildIdPath(target))
  ? fs.readFileSync(buildIdPath(target), "utf8").trim()
  : null;

if (installed !== expected) {
  console.error(
    `Install verification failed: ${target} reports build ${installed ?? "none"}, ` +
      `expected ${expected}. The old app may still be in place.`,
  );
  process.exit(1);
}

console.log(`Installed to ${target} (build ${expected})`);
