import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "@/lib/config/app-config";
import { ensureLocalDir } from "./local-client";

export type Db = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __millDb?: Db; __millClient?: Client };

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("No storage location is configured.");
    this.name = "StorageNotConfiguredError";
  }
}

export function getDb(): Db {
  if (globalForDb.__millDb) return globalForDb.__millDb;

  const url = resolveDatabaseUrl();
  if (!url) throw new StorageNotConfiguredError();

  ensureLocalDir(url);
  const client = createClient({ url });
  client.execute("PRAGMA foreign_keys = ON;").catch(() => {});

  const db = drizzle(client, { schema });
  globalForDb.__millDb = db;
  globalForDb.__millClient = client;
  return db;
}

export function closeDb(): void {
  try {
    globalForDb.__millClient?.close();
  } catch {}
  globalForDb.__millClient = undefined;
  globalForDb.__millDb = undefined;
}
