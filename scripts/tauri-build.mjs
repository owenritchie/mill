import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const env = { ...process.env };
const cargoBin = path.join(os.homedir(), ".cargo", "bin");

const hasCargo = () =>
  spawnSync("cargo", ["--version"], { env, stdio: "ignore" }).status === 0;

if (!hasCargo() && fs.existsSync(path.join(cargoBin, "cargo"))) {
  env.PATH = `${cargoBin}${path.delimiter}${env.PATH ?? ""}`;
}

if (!hasCargo()) {
  console.error(
    "Rust toolchain not found. Install it from https://rustup.rs, then re-run.",
  );
  process.exit(1);
}

const res = spawnSync("npx", ["tauri", "build", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});

process.exit(res.status ?? 1);
