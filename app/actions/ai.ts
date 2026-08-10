"use server";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { decisions, topics } from "@/lib/db/schema";
import { getAllConfig } from "@/lib/db/queries/config";
import { addDecision, updateDecision, updateTopic } from "@/app/actions/topic";
import { serializeTopicToMCF } from "@/lib/serialization";
import { friendlyProviderError, generateStructured } from "@/lib/ai/provider";
import { TONES } from "@/lib/types";
import type { Decision, Topic, Priority, Tone } from "@/lib/types";

export type EnhanceDecisionResult =
  | { ok: true; title: string; note: string }
  | { ok: false; error: string };

export type EnhanceTopicResult =
  | { ok: true; topic: Topic }
  | { ok: false; error: string };

export interface TopicDraft {
  title: string;
  summary: string;
  tone: Tone;
  priority: Priority | null;
  tags: string[];
  decisions: { id?: string; title: string; note: string }[];
}

export type EnhanceTopicDraftResult =
  | { ok: true; draft: TopicDraft }
  | { ok: false; error: string };

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    note: { type: "string" },
  },
  required: ["title", "note"],
} as const;

const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

const TOPIC_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    tone: { type: "string", enum: TONES },
    priority: { type: ["string", "null"], enum: [...PRIORITIES, null] },
    tags: { type: "array", items: { type: "string" } },
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          note: { type: "string" },
        },
        required: ["title", "note"],
      },
    },
  },
  required: ["title", "summary", "tone", "tags", "decisions"],
} as const;

const SYSTEM_PROMPT =
  "You are Mill — a decision-oriented thinking tool. You sharpen vague decisions " +
  "into clear, committed calls. Titles are short and action-shaped (3–8 words). " +
  "Notes are 1–3 sentences of rationale, not summary. Stay consistent with sibling " +
  "decisions — never restate or contradict them.";

const SYSTEM_PROMPT_TOPIC =
  "You are Mill — a decision-oriented thinking tool. You sharpen entire topics into " +
  "a clear plan of committed decisions. Fill empty fields, tighten verbose ones, " +
  "and write rationales for blank notes. PRESERVE the `id` of decisions you are " +
  "modifying. To ADD a new decision, omit its `id`. NEVER remove a decision. Keep " +
  "the tone, priority, and tags appropriate to the topic's energy.";

export async function enhanceDecision(decisionId: string): Promise<EnhanceDecisionResult> {
  try {
    const topic = await loadTopicForDecision(decisionId);
    if (!topic) return { ok: false, error: "Decision not found." };

    const target = topic.decisions.find((d) => d.id === decisionId);
    if (!target) return { ok: false, error: "Decision not found." };

    const mcf = serializeTopicToMCF(topic);
    const prompt = buildPrompt(mcf, decisionId, target.title);

    const cfg = await getAllConfig();
    const raw = await generateStructured(cfg, SYSTEM_PROMPT, prompt, DECISION_SCHEMA);
    const fields = parseDecisionResponse(raw);

    await updateDecision(decisionId, fields);
    return { ok: true, ...fields };
  } catch (err) {
    return { ok: false, error: friendlyProviderError(err) };
  }
}

export async function enhanceTopic(topicId: string): Promise<EnhanceTopicResult> {
  try {
    const current = await loadTopicById(topicId);
    if (!current) return { ok: false, error: "Topic not found." };

    const mcf = serializeTopicToMCF(current);
    const prompt = buildTopicPrompt(mcf, topicId);

    const cfg = await getAllConfig();
    const raw = await generateStructured(cfg, SYSTEM_PROMPT_TOPIC, prompt, TOPIC_SCHEMA);
    const next = parseTopicResponse(raw);

    await updateTopic(topicId, {
      title: next.title,
      summary: next.summary,
      tone: next.tone,
      priority: next.priority,
      tags: next.tags,
    });

    const existingIds = new Set(current.decisions.map((d) => d.id));
    const maxPosition = current.decisions.reduce(
      (max, d) => (d.position > max ? d.position : max),
      -1,
    );

    const finalDecisions: Decision[] = [];
    const seenExisting = new Set<string>();
    let appended = 0;

    for (const incoming of next.decisions) {
      if (incoming.id && existingIds.has(incoming.id)) {
        await updateDecision(incoming.id, {
          title: incoming.title,
          note: incoming.note,
        });
        const prev = current.decisions.find((d) => d.id === incoming.id)!;
        finalDecisions.push({
          id: incoming.id,
          title: incoming.title,
          note: incoming.note,
          position: prev.position,
        });
        seenExisting.add(incoming.id);
      } else {
        const newId = crypto.randomUUID();
        const position = maxPosition + 1 + appended;
        await addDecision({
          id: newId,
          topicId,
          title: incoming.title,
          note: incoming.note,
          position,
        });
        finalDecisions.push({
          id: newId,
          title: incoming.title,
          note: incoming.note,
          position,
        });
        appended++;
      }
    }

    for (const d of current.decisions) {
      if (!seenExisting.has(d.id)) finalDecisions.push(d);
    }
    finalDecisions.sort((a, b) => a.position - b.position);

    return {
      ok: true,
      topic: {
        ...current,
        title: next.title,
        summary: next.summary,
        tone: next.tone,
        priority: next.priority,
        tags: next.tags,
        decisions: finalDecisions,
      },
    };
  } catch (err) {
    return { ok: false, error: friendlyProviderError(err) };
  }
}

function buildTransientTopic(
  meta: { title: string; summary: string; tone: Tone; priority: Priority | null; tags: string[] },
  decs: { id: string; title: string; note: string }[],
): Topic {
  return {
    id: "draft",
    title: meta.title,
    summary: meta.summary,
    tone: meta.tone,
    priority: meta.priority,
    tags: meta.tags,
    collapsed: false,
    position: 0,
    issueUrl: undefined,
    startDate: undefined,
    endDate: undefined,
    decisions: decs.map((d, i) => ({ id: d.id, title: d.title, note: d.note, position: i })),
  };
}

export async function enhanceTopicDraft(input: {
  title: string;
  summary: string;
  tone: Tone;
  priority: Priority | null;
  tags: string[];
  decisions: { id: string; title: string; note: string }[];
}): Promise<EnhanceTopicDraftResult> {
  try {
    const transient = buildTransientTopic(input, input.decisions);
    const mcf = serializeTopicToMCF(transient);
    const prompt = buildTopicPrompt(mcf, transient.id);

    const cfg = await getAllConfig();
    const raw = await generateStructured(cfg, SYSTEM_PROMPT_TOPIC, prompt, TOPIC_SCHEMA);
    const next = parseTopicResponse(raw);

    return {
      ok: true,
      draft: {
        title: next.title,
        summary: next.summary,
        tone: next.tone,
        priority: next.priority,
        tags: next.tags,
        decisions: next.decisions,
      },
    };
  } catch (err) {
    return { ok: false, error: friendlyProviderError(err) };
  }
}

export async function enhanceDecisionDraft(input: {
  topic: { title: string; summary: string; tone: Tone; priority: Priority | null; tags: string[] };
  decisions: { id: string; title: string; note: string }[];
  targetId: string;
}): Promise<EnhanceDecisionResult> {
  try {
    const target = input.decisions.find((d) => d.id === input.targetId);
    if (!target) return { ok: false, error: "Decision not found." };

    const transient = buildTransientTopic(input.topic, input.decisions);
    const mcf = serializeTopicToMCF(transient);
    const prompt = buildPrompt(mcf, input.targetId, target.title);

    const cfg = await getAllConfig();
    const raw = await generateStructured(cfg, SYSTEM_PROMPT, prompt, DECISION_SCHEMA);
    const fields = parseDecisionResponse(raw);

    return { ok: true, ...fields };
  } catch (err) {
    return { ok: false, error: friendlyProviderError(err) };
  }
}

function buildPrompt(mcf: string, targetId: string, currentTitle: string): string {
  const stance = currentTitle.trim()
    ? "Sharpen the title and write a fresh rationale that explains the trade-off."
    : "The title is empty — propose one based on the topic and sibling decisions, then write a rationale.";

  return [
    "CONTEXT — the topic this decision belongs to, in MCF:",
    "",
    mcf,
    "",
    `TASK: Rewrite the decision with id \`${targetId}\`. ${stance}`,
    "",
    "Return JSON with exactly two fields:",
    "  - title: short, action-shaped (3–8 words)",
    "  - note: 1–3 sentences of rationale",
  ].join("\n");
}

function buildTopicPrompt(mcf: string, topicId: string): string {
  return [
    "CONTEXT — the topic you are enhancing, in MCF:",
    "",
    mcf,
    "",
    `TASK: Rewrite topic \`${topicId}\` end-to-end. Fill blanks, sharpen vague titles, and write rationales for decisions that lack notes. Preserve each existing decision's \`id\`. Add at most one or two new decisions if there's an obvious gap. Do NOT remove decisions.`,
    "",
    "Return JSON with these fields:",
    `  - title: short, action-shaped`,
    `  - summary: 1–2 sentences of what this topic is about`,
    `  - tone: one of ${TONES.join(", ")}`,
    `  - priority: one of ${PRIORITIES.join(", ")} or null`,
    `  - tags: array of short kebab-case strings`,
    `  - decisions: array of { id?, title, note } — include id to modify an existing decision, omit to add a new one`,
  ].join("\n");
}

function parseDecisionResponse(raw: unknown): { title: string; note: string } {
  const obj = raw as { title?: unknown; note?: unknown };
  const title = typeof obj?.title === "string" ? obj.title.trim() : "";
  const note = typeof obj?.note === "string" ? obj.note.trim() : "";
  if (!title && !note) throw new Error("Model returned an empty decision.");
  return { title, note };
}

interface ParsedTopicResponse {
  title: string;
  summary: string;
  tone: Tone;
  priority: Priority | null;
  tags: string[];
  decisions: { id?: string; title: string; note: string }[];
}

function parseTopicResponse(raw: unknown): ParsedTopicResponse {
  const obj = raw as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const toneRaw = typeof obj.tone === "string" ? obj.tone.trim() : "";
  const tone = (TONES as readonly string[]).includes(toneRaw) ? (toneRaw as Tone) : "ink";
  const priorityRaw = typeof obj.priority === "string" ? obj.priority.trim() : "";
  const priority = (PRIORITIES as readonly string[]).includes(priorityRaw)
    ? (priorityRaw as Priority)
    : null;
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean)
    : [];
  const decisionsRaw = Array.isArray(obj.decisions) ? obj.decisions : [];
  const decisions = decisionsRaw
    .map((d): { id?: string; title: string; note: string } | null => {
      const rec = d as Record<string, unknown>;
      const dTitle = typeof rec.title === "string" ? rec.title.trim() : "";
      const dNote = typeof rec.note === "string" ? rec.note.trim() : "";
      if (!dTitle && !dNote) return null;
      const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : undefined;
      return { id, title: dTitle, note: dNote };
    })
    .filter((d): d is { id?: string; title: string; note: string } => d !== null);

  if (!title) throw new Error("Model returned a topic with no title.");
  return { title, summary, tone, priority, tags, decisions };
}

async function loadTopicById(topicId: string): Promise<Topic | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  if (!row) return null;

  const decs = await db
    .select()
    .from(decisions)
    .where(eq(decisions.topicId, topicId))
    .orderBy(asc(decisions.position));

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    tone: row.tone,
    priority: row.priority,
    tags: row.tags,
    collapsed: row.collapsed,
    position: row.position,
    issueUrl: row.issueUrl ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    decisions: decs.map((d) => ({
      id: d.id,
      title: d.title,
      note: d.note,
      position: d.position,
    })),
  };
}

async function loadTopicForDecision(decisionId: string): Promise<Topic | null> {
  const db = getDb();
  const [dec] = await db
    .select({ topicId: decisions.topicId })
    .from(decisions)
    .where(eq(decisions.id, decisionId))
    .limit(1);
  if (!dec) return null;
  return loadTopicById(dec.topicId);
}
