"use server";

import {
  getAllTags,
  setAllTags,
  setSettings,
  getSetting,
  getAllConfig,
  getChatHooks,
  getClaudeModelVersions,
  getEnabledHookIds,
  setChatHooks,
  setClaudeModelVersion,
  setEnabledHookIds,
} from "@/lib/db/queries/config";
import { callClaudeCli, friendlyProviderError } from "@/lib/ai/provider";
import { CLAUDE_MODEL_ALIASES, DEFAULT_OLLAMA_ENDPOINT } from "@/lib/types";
import type { AiSettingsInput, ChatHook, OllamaModel } from "@/lib/types";

export async function addTag(tag: string): Promise<void> {
  const clean = tag.trim();
  if (!clean) return;
  const current = await getAllTags();
  if (!current.includes(clean)) await setAllTags([...current, clean]);
}

export async function loadChatHooks(): Promise<{ hooks: ChatHook[]; enabled: string[] }> {
  const [hooks, enabled] = await Promise.all([getChatHooks(), getEnabledHookIds()]);
  const live = new Set(hooks.map((h) => h.id));
  return { hooks, enabled: enabled.filter((id) => live.has(id)) };
}

export async function saveChatHooks(hooks: ChatHook[]): Promise<ChatHook[]> {
  await setChatHooks(hooks);
  return getChatHooks();
}

export async function saveEnabledHooks(ids: string[]): Promise<void> {
  await setEnabledHookIds(ids);
}

export async function updateAiSettings(input: AiSettingsInput): Promise<void> {
  await setSettings({
    ai_provider: input.aiProvider,
    ollama_endpoint: input.ollamaEndpoint.trim(),
    ollama_model: input.ollamaModel.trim(),
    claude_cli_command: input.claudeCliCommand.trim(),
    claude_model: input.claudeModel.trim(),
  });
}

async function resolveAndCacheAlias(cfg: Record<string, string>, alias: string): Promise<void> {
  const res = await callClaudeCli("Reply with: ok", { ...cfg, claude_model: alias });
  if (res.model) await setClaudeModelVersion(alias, res.model);
}

export async function resolveClaudeModelVersions(): Promise<Record<string, string>> {
  const cfg = await getAllConfig();
  const current = await getClaudeModelVersions();
  if (cfg.ai_provider !== "claude_cli") return current;

  const missing = CLAUDE_MODEL_ALIASES.filter((a) => !current[a]);
  if (missing.length === 0) return current;

  await Promise.all(missing.map((alias) => resolveAndCacheAlias(cfg, alias).catch(() => {})));
  return getClaudeModelVersions();
}

export type ClaudeModelCheck =
  | { ok: true; resolved: string }
  | { ok: false; error: string };

export async function checkClaudeModel(model: string): Promise<ClaudeModelCheck> {
  const trimmed = model.trim();
  if (!trimmed) return { ok: false, error: "Enter a model id or alias first." };
  const cfg = await getAllConfig();
  try {
    const res = await callClaudeCli("Reply with: ok", { ...cfg, claude_model: trimmed });
    const resolved = res.model ?? trimmed;
    if (res.model && (CLAUDE_MODEL_ALIASES as readonly string[]).includes(trimmed)) {
      await setClaudeModelVersion(trimmed, res.model);
    }
    return { ok: true, resolved };
  } catch (e) {
    return { ok: false, error: friendlyProviderError(e) };
  }
}

export type OllamaModelsResult =
  | { ok: true; models: OllamaModel[] }
  | { ok: false; error: string };

export async function listOllamaModels(
  endpoint?: string
): Promise<OllamaModelsResult> {
  const base = (
    endpoint?.trim() ||
    (await getSetting("ollama_endpoint")) ||
    DEFAULT_OLLAMA_ENDPOINT
  ).replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/tags`);
    if (!res.ok) {
      return { ok: false, error: `Ollama responded ${res.status}.` };
    }
    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        model?: string;
        size?: number;
        details?: {
          parameter_size?: string;
          quantization_level?: string;
          family?: string;
        };
      }>;
    };
    const models: OllamaModel[] = (data.models ?? [])
      .map((m) => ({
        name: m.name || m.model || "",
        size: typeof m.size === "number" ? m.size : 0,
        paramSize: m.details?.parameter_size ?? "",
        quant: m.details?.quantization_level ?? "",
        family: m.details?.family ?? "",
      }))
      .filter((m) => m.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, models };
  } catch {
    return { ok: false, error: "Could not reach Ollama. Make sure it is running." };
  }
}
