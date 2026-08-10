import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function ensureLocalDir(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (path) mkdirSync(dirname(path), { recursive: true });
}
