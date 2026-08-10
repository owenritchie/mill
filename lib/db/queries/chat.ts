import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { ensureSchema } from "@/lib/db/ensure-schema";
import { resolveDatabaseUrl } from "@/lib/config/app-config";
import { CHAT_HISTORY_DAYS } from "@/lib/types";
import type { ChatMessage, ChatMode, ChatSummary, StoredChat, TokenUsage } from "@/lib/types";

const cutoff = () => new Date(Date.now() - CHAT_HISTORY_DAYS * 24 * 60 * 60 * 1000);

let migrated = false;
async function withChats<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (migrated || !isSchemaBehind(err)) throw err;
    const url = resolveDatabaseUrl();
    if (!url) throw err;
    await ensureSchema(url);
    migrated = true;
    return run();
  }
}

function isSchemaBehind(err: unknown): boolean {
  const behind = /no such (table|column)/i;
  for (let e: unknown = err, depth = 0; e && depth < 6; depth++) {
    if (e instanceof Error) {
      if (behind.test(e.message)) return true;
      e = (e as { cause?: unknown }).cause;
    } else {
      return behind.test(String(e));
    }
  }
  return false;
}

export async function listRecentChats(userId: string): Promise<ChatSummary[]> {
  return withChats(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(chats)
      .where(and(eq(chats.userId, userId), gte(chats.updatedAt, cutoff())))
      .orderBy(desc(chats.updatedAt));
    return rows.map(toSummary);
  });
}

export async function getChat(userId: string, id: string): Promise<StoredChat | null> {
  return withChats(async () => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.userId, userId), eq(chats.id, id)))
      .limit(1);
    if (!row) return null;
    return { ...toSummary(row), messages: parseMessages(row.messages) };
  });
}

export interface SaveChatInput {
  id: string;
  userId: string;
  title: string;
  mode: ChatMode;
  messages: ChatMessage[];
  usage?: TokenUsage;
}

export async function saveChat(input: SaveChatInput): Promise<void> {
  return withChats(async () => {
    const db = getDb();
    const now = new Date();
    const totals = {
      inputTokens: input.usage?.inputTokens ?? 0,
      outputTokens: input.usage?.outputTokens ?? 0,
      cacheReadTokens: input.usage?.cacheReadTokens ?? 0,
      cacheWriteTokens: input.usage?.cacheWriteTokens ?? 0,
      costMicros: Math.round((input.usage?.costUsd ?? 0) * 1_000_000),
    };
    const row = {
      title: input.title.slice(0, 120),
      mode: input.mode,
      messages: input.messages as unknown[],
      ...totals,
      updatedAt: now,
    };
    await db
      .insert(chats)
      .values({ id: input.id, userId: input.userId, createdAt: now, ...row })
      .onConflictDoUpdate({ target: chats.id, set: row });
  });
}

export async function deleteChat(userId: string, id: string): Promise<void> {
  return withChats(async () => {
    const db = getDb();
    await db.delete(chats).where(and(eq(chats.userId, userId), eq(chats.id, id)));
  });
}

export async function pruneOldChats(userId: string): Promise<void> {
  return withChats(async () => {
    const db = getDb();
    await db.delete(chats).where(and(eq(chats.userId, userId), lt(chats.updatedAt, cutoff())));
  });
}

type ChatRow = typeof chats.$inferSelect;

function toSummary(row: ChatRow): ChatSummary {
  const usage: TokenUsage | undefined =
    row.inputTokens || row.outputTokens || row.cacheWriteTokens
      ? {
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cacheReadTokens: row.cacheReadTokens || undefined,
          cacheWriteTokens: row.cacheWriteTokens || undefined,
          costUsd: row.costMicros ? row.costMicros / 1_000_000 : undefined,
        }
      : undefined;
  return {
    id: row.id,
    title: row.title,
    mode: row.mode === "build" ? "build" : "plan",
    messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
    usage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    const m = (item ?? {}) as Record<string, unknown>;
    const text = typeof m.text === "string" ? m.text : "";
    if (!text) continue;
    out.push({
      id: typeof m.id === "string" ? m.id : crypto.randomUUID(),
      role: m.role === "user" ? "user" : "assistant",
      text,
      createdAt: m.createdAt ? new Date(m.createdAt as string) : new Date(),
      usage: parseUsage(m.usage),
      stopped: m.stopped === true,
      noBuildActions: m.noBuildActions === true,
    });
  }
  return out;
}

function parseUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  const inputTokens = num(u.inputTokens);
  const outputTokens = num(u.outputTokens);
  const cacheWriteTokens = num(u.cacheWriteTokens);
  if (!inputTokens && !outputTokens && !cacheWriteTokens) return undefined;
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: num(u.cacheReadTokens) || undefined,
    cacheWriteTokens: cacheWriteTokens || undefined,
    costUsd: num(u.costUsd) || undefined,
  };
}
