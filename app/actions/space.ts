"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { getOrCreateDefaultUser } from "@/lib/db/queries/user";

export async function createSpace(input: {
  id: string;
  name: string;
  position: number;
}): Promise<void> {
  const user = await getOrCreateDefaultUser();
  await getDb().insert(spaces).values({
    id: input.id,
    userId: user.id,
    name: input.name,
    position: input.position,
  });
}

export async function renameSpace(id: string, name: string): Promise<void> {
  await getDb().update(spaces).set({ name }).where(eq(spaces.id, id));
}

export async function deleteSpace(id: string): Promise<void> {
  await getDb().delete(spaces).where(eq(spaces.id, id));
}
