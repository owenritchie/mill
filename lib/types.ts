export type Tone = "forest" | "coral" | "butter" | "sage" | "peri" | "rose" | "ink" | "plum";
export type Priority = "p1" | "p2" | "p3" | "p4";

export interface Decision {
  id: string;
  title: string;
  note: string;
  position: number;
}

export interface Topic {
  id: string;
  title: string;
  summary: string;
  tone: Tone;
  priority: Priority | null;
  tags: string[];
  collapsed: boolean;
  position: number;
  decisions: Decision[];
  issueUrl?: string;
  startDate?: string;
  endDate?: string;
}

export const TOPIC_LIMITS = {
  title: 100,
  summary: 500,
  tags: 12,
  tagLength: 24,
} as const;

export interface ProjectLink {
  outbound: string;
  inbound: string;
}

export interface SpaceProject {
  id: string;
  name: string;
  tagline: string;
  color: string;
  topics: Topic[];
  links: ProjectLink[];
}

export interface Space {
  id: string;
  name: string;
  projects: SpaceProject[];
}

export type AiProvider = "ollama" | "claude_cli";

export interface AppSettings {
  aiProvider: AiProvider;
  ollamaEndpoint: string;
  ollamaModel: string;
  claudeCliCommand: string;
  claudeModel: string;
  claudeModelVersions: Record<string, string>;
  defaultTone: Tone;
}

export interface StorageInfo {
  configured: boolean;
  source: "file" | "env" | "none";
  display: string | null;
}

export interface StorageTestResult {
  ok: boolean;
  error?: string;
  migrated?: boolean;
}

export interface AiSettingsInput {
  aiProvider: AiProvider;
  ollamaEndpoint: string;
  ollamaModel: string;
  claudeCliCommand: string;
  claudeModel: string;
}

export const DEFAULT_CLAUDE_CLI_COMMAND = "claude -p --output-format json";

export const CLAUDE_MODEL_ALIASES = ["opus", "sonnet", "haiku"] as const;

export const DEFAULT_CLAUDE_MODEL = "sonnet";

export function claudeModelLabel(value: string): string {
  return (CLAUDE_MODEL_ALIASES as readonly string[]).includes(value)
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;
}

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434/api";

export interface OllamaModel {
  name: string;
  size: number;
  paramSize: string;
  quant: string;
  family: string;
}

export type ChatMode = "plan" | "build";

export type ChatAction =
  | { type: "createProject"; tempId?: string; spaceId?: string; name: string; tagline?: string; color?: string }
  | { type: "updateProject"; projectId: string; name?: string; tagline?: string; color?: string }
  | { type: "deleteProject"; projectId: string }
  | { type: "moveProject"; projectId: string; targetSpaceId: string; position?: number }
  | {
      type: "createTopic";
      tempId?: string;
      projectId: string;
      title: string;
      summary?: string;
      tone?: Tone;
      priority?: Priority | null;
      tags?: string[];
      startDate?: string;
      endDate?: string;
      issueUrl?: string;
      decisions?: { title: string; note?: string }[];
    }
  | {
      type: "updateTopic";
      topicId: string;
      title?: string;
      summary?: string;
      tone?: Tone;
      priority?: Priority | null;
      tags?: string[];
      startDate?: string | null;
      endDate?: string | null;
      issueUrl?: string | null;
    }
  | { type: "deleteTopic"; topicId: string }
  | { type: "createDecision"; topicId: string; title: string; note?: string }
  | { type: "updateDecision"; decisionId: string; title?: string; note?: string }
  | { type: "deleteDecision"; decisionId: string }
  | { type: "createLink"; outbound: string; inbound: string }
  | { type: "deleteLink"; outbound: string; inbound: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: Date;
  actions?: ChatAction[];
  actionState?: "proposed" | "applied" | "dismissed";
  noBuildActions?: boolean;
  usage?: TokenUsage;
  stopped?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
}

export const totalTokens = (u: TokenUsage): number =>
  u.inputTokens + u.outputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);

export function addUsage(a: TokenUsage | undefined, b: TokenUsage | undefined): TokenUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  const costUsd =
    a.costUsd === undefined && b.costUsd === undefined
      ? undefined
      : (a.costUsd ?? 0) + (b.costUsd ?? 0);
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: (a.cacheReadTokens ?? 0) + (b.cacheReadTokens ?? 0) || undefined,
    cacheWriteTokens: (a.cacheWriteTokens ?? 0) + (b.cacheWriteTokens ?? 0) || undefined,
    costUsd,
  };
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export interface ChatHook {
  id: string;
  name: string;
  prompt: string;
}

export const HOOK_WORD_LIMIT = 200;

export const HOOK_LIMIT = 20;

export const countWords = (s: string): number =>
  s.trim() ? s.trim().split(/\s+/).length : 0;

export function clampWords(s: string, limit = HOOK_WORD_LIMIT): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words.length <= limit ? s.trim() : words.slice(0, limit).join(" ");
}

export const CHAT_HISTORY_DAYS = 7;

export interface ChatSummary {
  id: string;
  title: string;
  mode: ChatMode;
  messageCount: number;
  usage?: TokenUsage;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredChat extends ChatSummary {
  messages: ChatMessage[];
}

export const PRIORITY_META: Record<Priority, { label: string; desc: string; color: string; soft: string }> = {
  p1: { label: "P1", desc: "Urgent",  color: "#d94f4f", soft: "#fde8e8" },
  p2: { label: "P2", desc: "High",    color: "#c4992f", soft: "#f8e6bf" },
  p3: { label: "P3", desc: "Medium",  color: "#2a9d97", soft: "#d0efee" },
  p4: { label: "P4", desc: "Low",     color: "#b9b1a1", soft: "#f0ece6" },
};

export const TONES: Tone[] = ["forest", "coral", "butter", "sage", "peri", "rose", "ink", "plum"];

export const TONE_META: Record<Tone, { label: string; base: string; soft: string; deep: string }> = {
  forest: { label: "Forest", base: "#2A8C7A", soft: "#C5E5DE", deep: "#1a5c50" },
  coral:  { label: "Coral",  base: "#A05540", soft: "#F0D5C8", deep: "#7a3e2d" },
  butter: { label: "Butter", base: "#C8952A", soft: "#F5E2B0", deep: "#9a7020" },
  sage:   { label: "Sage",   base: "#6B7D2A", soft: "#DDE9B8", deep: "#4a5820" },
  peri:   { label: "Peri",   base: "#3B7EA6", soft: "#C5DDF0", deep: "#275a7a" },
  rose:   { label: "Rose",   base: "#C94040", soft: "#F5D0D0", deep: "#a02e2e" },
  ink:    { label: "Ink",    base: "#4A5880", soft: "#CDD3E8", deep: "#333d60" },
  plum:   { label: "Plum",   base: "#7A5478", soft: "#E3D4E0", deep: "#5a3d58" },
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const nz = (v?: string | null): string | null => (v && v.trim() ? v : null);

export function modelMeta(m: OllamaModel): string {
  const size = m.size ? (m.size >= 1e9 ? `${(m.size / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(m.size / 1e6))} MB`) : "";
  return [size, m.paramSize, m.quant].filter(Boolean).join(" · ");
}
