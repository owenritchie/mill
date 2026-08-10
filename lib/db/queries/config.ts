import { getDb } from "@/lib/db";
import { config } from "@/lib/db/schema";
import {
  clampWords,
  DEFAULT_CLAUDE_CLI_COMMAND,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_OLLAMA_ENDPOINT,
  HOOK_LIMIT,
} from "@/lib/types";
import type { AiProvider, AppSettings, ChatHook, Tone } from "@/lib/types";

export const CONFIG_DEFAULTS = {
  ai_provider: "ollama",
  ollama_endpoint: DEFAULT_OLLAMA_ENDPOINT,
  ollama_model: "llama3.1",
  claude_cli_command: DEFAULT_CLAUDE_CLI_COMMAND,
  claude_model: DEFAULT_CLAUDE_MODEL,
  claude_model_versions: "{}",
  default_tone: "ink",
  all_tags: "[]",
  chat_hooks: "[]",
  chat_hooks_enabled: "[]",
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export async function getAllConfig(): Promise<Record<string, string>> {
  const db = getDb();
  const rows = await db.select().from(config);
  const out: Record<string, string> = { ...CONFIG_DEFAULTS };
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function getSetting(key: ConfigKey): Promise<string> {
  const all = await getAllConfig();
  return all[key];
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(config)
    .values({ key, value })
    .onConflictDoUpdate({
      target: config.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, value);
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const c = await getAllConfig();
  const provider: AiProvider = c.ai_provider === "claude_cli" ? "claude_cli" : "ollama";
  return {
    aiProvider: provider,
    ollamaEndpoint: c.ollama_endpoint,
    ollamaModel: c.ollama_model,
    claudeCliCommand: c.claude_cli_command,
    claudeModel: c.claude_model,
    claudeModelVersions: parseVersionMap(c.claude_model_versions),
    defaultTone: (c.default_tone as Tone) || "ink",
  };
}

export async function getClaudeModelVersions(): Promise<Record<string, string>> {
  return parseVersionMap(await getSetting("claude_model_versions"));
}

function parseVersionMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function setClaudeModelVersion(alias: string, modelId: string): Promise<void> {
  const a = alias.trim();
  const m = modelId.trim();
  if (!a || !m) return;
  const current = parseVersionMap(await getSetting("claude_model_versions"));
  if (current[a] === m) return;
  await setSetting("claude_model_versions", JSON.stringify({ ...current, [a]: m }));
}

export async function getChatHooks(): Promise<ChatHook[]> {
  const raw = await getSetting("chat_hooks");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ChatHook[] = [];
    for (const item of parsed) {
      const h = (item ?? {}) as Record<string, unknown>;
      const id = typeof h.id === "string" ? h.id : "";
      const name = typeof h.name === "string" ? h.name.trim() : "";
      const prompt = typeof h.prompt === "string" ? h.prompt.trim() : "";
      if (id && name && prompt) out.push({ id, name, prompt: clampWords(prompt) });
    }
    return out.slice(0, HOOK_LIMIT);
  } catch {
    return [];
  }
}

export async function setChatHooks(hooks: ChatHook[]): Promise<void> {
  const clean = hooks
    .map((h) => ({
      id: h.id,
      name: h.name.trim().slice(0, 60),
      prompt: clampWords(h.prompt),
    }))
    .filter((h) => h.id && h.name && h.prompt)
    .slice(0, HOOK_LIMIT);
  await setSetting("chat_hooks", JSON.stringify(clean));
  const live = new Set(clean.map((h) => h.id));
  const enabled = await getEnabledHookIds();
  const kept = enabled.filter((id) => live.has(id));
  if (kept.length !== enabled.length) await setEnabledHookIds(kept);
}

export async function getEnabledHookIds(): Promise<string[]> {
  const raw = await getSetting("chat_hooks_enabled");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function setEnabledHookIds(ids: string[]): Promise<void> {
  await setSetting("chat_hooks_enabled", JSON.stringify([...new Set(ids)]));
}

export async function getAllTags(): Promise<string[]> {
  const raw = await getSetting("all_tags");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function setAllTags(tags: string[]): Promise<void> {
  await setSetting("all_tags", JSON.stringify([...new Set(tags)]));
}
