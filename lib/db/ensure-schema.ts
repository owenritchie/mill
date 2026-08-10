import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import { ensureLocalDir } from "./local-client";

export async function ensureSchema(url: string): Promise<void> {
  ensureLocalDir(url);
  const client = createClient({ url });
  try {
    await migrate(drizzle(client, { schema }), {
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
  } finally {
    client.close();
  }
}
