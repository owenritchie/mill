import { spawn } from "child_process";
import { DEFAULT_CLAUDE_CLI_COMMAND, DEFAULT_OLLAMA_ENDPOINT } from "@/lib/types";
import type { TokenUsage } from "@/lib/types";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class ProviderError extends Error {}

const CLAUDE_CLI_TIMEOUT_MS = 10 * 60_000;

export async function callOllama(
  messages: ProviderMessage[],
  cfg: Record<string, string>,
  format?: unknown,
): Promise<string> {
  return (await callOllamaDetailed(messages, cfg, format)).text;
}

export interface OllamaResult {
  text: string;
  usage?: TokenUsage;
}

export async function callOllamaDetailed(
  messages: ProviderMessage[],
  cfg: Record<string, string>,
  format?: unknown,
): Promise<OllamaResult> {
  const endpoint = (cfg.ollama_endpoint || DEFAULT_OLLAMA_ENDPOINT).replace(/\/+$/, "");
  const model = cfg.ollama_model || "llama3.1";
  const res = await fetch(`${endpoint}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, stream: false, ...(format ? { format } : {}), messages }),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200).trim();
    throw new ProviderError(`Ollama responded ${res.status}${body ? `. ${body}` : ""}`);
  }
  const data = (await res.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const inputTokens = num(data.prompt_eval_count);
  const outputTokens = num(data.eval_count);
  return {
    text: data.message?.content ?? "",
    usage: inputTokens || outputTokens ? { inputTokens, outputTokens } : undefined,
  };
}

export interface ClaudeResult {
  text: string;
  model: string | null;
  usage?: TokenUsage;
}

export async function callClaudeCli(
  prompt: string,
  cfg: Record<string, string>,
): Promise<ClaudeResult> {
  const template = (cfg.claude_cli_command || DEFAULT_CLAUDE_CLI_COMMAND).trim();
  if (!template) throw new ProviderError("Claude CLI command is not configured.");
  const [bin, ...args] = template.split(/\s+/).filter(Boolean);
  if (!bin) throw new ProviderError("Claude CLI command is empty.");

  const model = (cfg.claude_model || "").trim();
  if (model && !args.includes("--model")) args.push("--model", model);

  const stdout = await runProcess(bin, args, prompt, CLAUDE_CLI_TIMEOUT_MS);

  let envelope: {
    result?: unknown;
    is_error?: boolean;
    modelUsage?: unknown;
    usage?: unknown;
    total_cost_usd?: unknown;
  };
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new ProviderError("Claude CLI returned non-JSON output. Check the command flags.");
  }
  if (envelope.is_error) {
    const msg = typeof envelope.result === "string" ? envelope.result.trim() : "";
    throw new ProviderError(msg ? msg.slice(0, 200) : "Claude CLI reported an error.");
  }
  const inner = typeof envelope.result === "string" ? envelope.result.trim() : "";
  if (!inner) throw new ProviderError("Claude CLI returned an empty result.");

  return {
    text: inner,
    model: pickResolvedModel(envelope.modelUsage, model),
    usage: readClaudeUsage(envelope),
  };
}

function readClaudeUsage(envelope: {
  usage?: unknown;
  modelUsage?: unknown;
  total_cost_usd?: unknown;
}): TokenUsage | undefined {
  const cost = num(envelope.total_cost_usd);

  if (envelope.modelUsage && typeof envelope.modelUsage === "object") {
    const per = Object.values(envelope.modelUsage as Record<string, unknown>);
    const total: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
    };
    for (const entry of per) {
      const u = (entry ?? {}) as Record<string, unknown>;
      total.inputTokens += num(u.inputTokens);
      total.outputTokens += num(u.outputTokens);
      total.cacheReadTokens = (total.cacheReadTokens ?? 0) + num(u.cacheReadInputTokens);
      total.cacheWriteTokens = (total.cacheWriteTokens ?? 0) + num(u.cacheCreationInputTokens);
      total.costUsd = (total.costUsd ?? 0) + num(u.costUSD);
    }
    if (total.inputTokens || total.outputTokens || total.cacheWriteTokens) {
      return {
        ...total,
        cacheReadTokens: total.cacheReadTokens || undefined,
        cacheWriteTokens: total.cacheWriteTokens || undefined,
        costUsd: total.costUsd || cost || undefined,
      };
    }
  }

  const u = (envelope.usage ?? {}) as Record<string, unknown>;
  const inputTokens = num(u.input_tokens);
  const outputTokens = num(u.output_tokens);
  const cacheWriteTokens = num(u.cache_creation_input_tokens);
  if (!inputTokens && !outputTokens && !cacheWriteTokens) return undefined;
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: num(u.cache_read_input_tokens) || undefined,
    cacheWriteTokens: cacheWriteTokens || undefined,
    costUsd: cost || undefined,
  };
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0);

function pickResolvedModel(modelUsage: unknown, alias: string): string | null {
  if (!modelUsage || typeof modelUsage !== "object") return null;
  const usage = modelUsage as Record<string, { outputTokens?: number }>;
  const keys = Object.keys(usage);
  if (keys.length <= 1) return keys[0] ?? null;

  const a = alias.trim().toLowerCase();
  if (a) {
    const match = keys.find((k) => k.toLowerCase().includes(a));
    if (match) return match;
  }
  return keys.reduce(
    (best, k) => ((usage[k]?.outputTokens ?? 0) > (usage[best]?.outputTokens ?? 0) ? k : best),
    keys[0],
  );
}

export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf("{");
  if (start === -1) return source.trim();
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start).trim();
}

export async function generateStructured(
  cfg: Record<string, string>,
  systemPrompt: string,
  userPrompt: string,
  schema: unknown,
): Promise<unknown> {
  return (await generateStructuredDetailed(cfg, systemPrompt, userPrompt, schema)).data;
}

export interface StructuredResult {
  data: unknown;
  model?: string;
  usage?: TokenUsage;
}

export async function generateStructuredDetailed(
  cfg: Record<string, string>,
  systemPrompt: string,
  userPrompt: string,
  schema: unknown,
): Promise<StructuredResult> {
  if (cfg.ai_provider === "claude_cli") {
    const prompt = [
      systemPrompt,
      "",
      userPrompt,
      "",
      "Output ONLY the JSON object. No prose, no preamble, no code fences.",
    ].join("\n");
    const res = await callClaudeCli(prompt, cfg);
    try {
      return {
        data: JSON.parse(extractJsonObject(res.text)),
        model: res.model ?? undefined,
        usage: res.usage,
      };
    } catch {
      throw new ProviderError("Claude returned invalid JSON inside the result.");
    }
  }

  const res = await callOllamaDetailed(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    cfg,
    schema,
  );
  const raw = res.text.trim();
  if (!raw) throw new ProviderError("Model returned an empty response.");
  try {
    return { data: JSON.parse(raw), usage: res.usage };
  } catch {
    try {
      return { data: JSON.parse(extractJsonObject(raw)), usage: res.usage };
    } catch {
      throw new ProviderError("Model returned invalid JSON.");
    }
  }
}

export function friendlyProviderError(err: unknown): string {
  if (err instanceof ProviderError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Could not reach the AI provider. Check your settings and that it's running.";
}

function runProcess(
  bin: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ProviderError(`'${bin}' timed out after ${timeoutMs / 1000}s.`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        reject(new ProviderError(`'${bin}' not found on PATH. Is the CLI installed?`));
      } else {
        reject(err);
      }
    });

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const trimmed = stderr.trim().slice(0, 200);
        reject(new ProviderError(`'${bin}' exited ${code}${trimmed ? `. ${trimmed}` : ""}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}
