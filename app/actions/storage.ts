"use server";

import { existsSync, rmSync } from "node:fs";
import {
  writeAppConfig,
  defaultLocalDbUrl,
  clearAppConfig,
  resolveDatabaseUrl,
} from "@/lib/config/app-config";
import { ensureSchema } from "@/lib/db/ensure-schema";
import { closeDb } from "@/lib/db";
import type { StorageTestResult } from "@/lib/types";

export async function setLocalStorageLocation(): Promise<StorageTestResult> {
  const url = defaultLocalDbUrl();
  try {
    await ensureSchema(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not create the local database: ${msg}` };
  }

  writeAppConfig(url);
  return { ok: true, migrated: true };
}

export async function resetEnvironment(): Promise<StorageTestResult> {
  const url = resolveDatabaseUrl();

  try {
    closeDb();

    if (url?.startsWith("file:")) {
      const path = url.slice("file:".length);
      for (const suffix of ["", "-wal", "-shm", "-journal"]) {
        const file = `${path}${suffix}`;
        if (existsSync(file)) rmSync(file);
      }
    }

    clearAppConfig();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not reset the environment: ${msg}` };
  }
}
