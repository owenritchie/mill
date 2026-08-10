import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NODE_VERSION = "v24.11.1";

const TRIPLES = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-x64": "x86_64-unknown-linux-gnu",
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = `${process.platform}-${process.arch}`;
const triple = TRIPLES[platform];

if (!triple) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const dest = path.join(root, "src-tauri", "binaries", `node-${triple}`);

if (fs.existsSync(dest)) {
  const version = execSync(`"${dest}" --version`).toString().trim();
  if (version === NODE_VERSION) {
    console.log(`node sidecar already present (${version})`);
    process.exit(0);
  }
}

const dir = `node-${NODE_VERSION}-${platform}`;
const url = `https://nodejs.org/dist/${NODE_VERSION}/${dir}.tar.gz`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mill-node-"));

console.log(`Downloading ${url}`);
execSync(`curl -fsSL "${url}" -o "${tmp}/node.tar.gz"`, { stdio: "inherit" });
execSync(`tar -xzf "${tmp}/node.tar.gz" -C "${tmp}" "${dir}/bin/node"`);

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(path.join(tmp, dir, "bin", "node"), dest);
fs.chmodSync(dest, 0o755);
fs.rmSync(tmp, { recursive: true, force: true });

const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(0);
console.log(`node sidecar ready: ${dest} (${size}MB)`);
