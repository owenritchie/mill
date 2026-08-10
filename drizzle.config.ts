import type { Config } from "drizzle-kit";
import { homedir } from "node:os";
import { join } from "node:path";

try {
  process.loadEnvFile();
} catch {
}

const url =
  process.env.DATABASE_URL?.trim() || `file:${join(homedir(), ".mill", "mill.db")}`;

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url },
} satisfies Config;
