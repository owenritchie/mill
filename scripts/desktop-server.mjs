import path from "node:path";
import { fileURLToPath } from "node:url";

const parentPid = process.ppid;

const watchdog = setInterval(() => {
  if (process.ppid !== parentPid) process.exit(0);
}, 1000);
watchdog.unref();

const here = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(here, "server.js"));
