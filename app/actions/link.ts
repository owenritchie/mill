"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { links } from "@/lib/db/schema";

export async function createLink(outbound: string, inbound: string): Promise<void> {
  await getDb().insert(links).values({ outbound, inbound }).onConflictDoNothing();
}

export async function deleteLink(outbound: string, inbound: string): Promise<void> {
  await getDb()
    .delete(links)
    .where(and(eq(links.outbound, outbound), eq(links.inbound, inbound)));
}
