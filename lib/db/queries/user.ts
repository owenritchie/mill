import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const DEFAULT_USER_EMAIL = "owenritchie04@gmail.com";

export async function getOrCreateDefaultUser() {
  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEFAULT_USER_EMAIL))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(users)
    .values({ email: DEFAULT_USER_EMAIL })
    .returning();
  return created;
}
