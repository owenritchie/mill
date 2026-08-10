"use server";

import {
  getAllConfig,
  getChatHooks,
  setClaudeModelVersion,
} from "@/lib/db/queries/config";
import { getOrCreateDefaultUser } from "@/lib/db/queries/user";
import { getWorkspaceBundle } from "@/lib/db/queries/workspace";
import { serializeWorkspaceToMCF } from "@/lib/serialization";
import {
  callClaudeCli,
  callOllamaDetailed,
  friendlyProviderError,
  generateStructuredDetailed,
} from "@/lib/ai/provider";
import {
  createProject,
  deleteProject,
  moveProject,
  updateProject,
} from "@/app/actions/project";
import {
  addDecision,
  createTopic,
  deleteDecision,
  deleteTopic,
  updateDecision,
  updateTopic,
} from "@/app/actions/topic";
import { createLink, deleteLink } from "@/app/actions/link";
import { addUsage, TONES } from "@/lib/types";
import type { ChatAction, ChatMode, Priority, Space, TokenUsage, Tone } from "@/lib/types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatResult =
  | {
      ok: true;
      reply: string;
      actions?: ChatAction[];
      model?: string;
      noActionsWarning?: boolean;
      usage?: TokenUsage;
    }
  | { ok: false; error: string };

export type ApplyResult =
  | { ok: true; spaces: Space[] }
  | { ok: false; error: string };

const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

const PLAN_SYSTEM =
  "You are Mill, a decision-oriented thinking partner. Help the user reason through " +
  "their projects, topics, and decisions. You are in PLAN mode: you CANNOT create or " +
  "change anything in the workspace, and must never claim to have done so.\n\n" +
  "STYLE — this matters as much as the content:\n" +
  "- Lead with the answer in the first sentence. No throat-clearing, no restating the question.\n" +
  "- Default to ~80–120 words. Only go longer if the user explicitly asks you to go deep.\n" +
  "- Prefer 2–4 tight bullets over long paragraphs. Bold only the key call, never whole phrases.\n" +
  "- Don't recap the workspace back to the user — they can see it. Cite a decision id only when pointing at a specific one.\n" +
  "- At most ONE follow-up question, and only if it would change your answer.\n" +
  "- Use light Markdown (a few bullets, occasional bold, backticks for ids). Don't over-format.";

const BUILD_SYSTEM =
  "You are Mill in BUILD mode — a workspace editor. The user asks for changes; you " +
  "PROPOSE them as structured actions the user will confirm. CRITICAL: the `actions` " +
  "array is the only thing that changes the workspace — a reply with no actions changes " +
  "NOTHING. So whenever the user asks you to create or edit something, you MUST emit the " +
  "matching actions IN THIS RESPONSE. Do NOT promise to do it later, \"next\", or in a " +
  "follow-up — a reply that describes changes while `actions` is empty is WRONG and stages " +
  "nothing. If the request is large (e.g. \"populate every topic\"), still emit as many " +
  "actions as you can in this one response instead of saying you WILL do it. Never claim " +
  "you already 'added' or 'created' anything (nothing applies until the user confirms) — " +
  "describe what applying the actions will do. " +
  "Reference existing spaces, projects, topics, and decisions by the exact ids in the " +
  "WORKSPACE context — never invent ids. To create something and reference it as a " +
  "parent in the same batch, set a `tempId` on the create and use that tempId as the " +
  "child's parent id. If the user is only chatting or asking a question, return an empty " +
  "actions array. Keep `reply` to ONE short sentence — the action cards carry the detail.\n\n" +
  "You can also: set a project's `color` (a hex like #2A8C7A) on create/update; move a " +
  "project to a different EXISTING space (`moveProject` with targetSpaceId); set a topic's " +
  "`startDate`/`endDate` (ISO YYYY-MM-DD) and `issueUrl` on create/update; and link or " +
  "unlink topics (`createLink`/`deleteLink` with `outbound` and `inbound` topic ids, shown " +
  "as `LINK a -> b` in the context). You CANNOT create, rename, or delete spaces.\n\n" +
  "DEPTH — when the user asks you to plan, design, flesh out a project, or build an " +
  "itinerary, produce a FULLY-DEVELOPED plan, not a skeleton of bare topic titles. Every " +
  "topic you create should ship with a one-line `summary` AND a `decisions` array of " +
  "concrete, specific decisions (the detail layer) — a topic with no decisions is an empty " +
  "shell. Put those decisions right on the `createTopic` action's `decisions` field in the " +
  "same turn. Aim for a few well-chosen decisions per topic (typically 3–6), each a " +
  "specific committed call with a short note, never a vague placeholder. Only stop at bare " +
  "topic titles if the user explicitly asks for an outline, a skeleton, or 'just the topics'.\n\n" +
  "STRUCTURE — beyond topics and decisions, use the connective tissue WITH JUDGMENT, sized " +
  "to the task:\n" +
  "- LINKS: when topics depend on, precede, or reference each other, connect them with " +
  "`createLink` (`outbound` -> `inbound`). Link topics you create in the same turn by their " +
  "`tempId`s. Favor links for sequences (day 1 -> day 2) and dependencies (book transport -> " +
  "everything downstream) — but only for real relationships, never link-everything.\n" +
  "- DATES: when the task has an actual timeline (a trip's days, a scheduled project), set " +
  "each topic's `startDate`/`endDate` (ISO YYYY-MM-DD). If the user gave no concrete dates, " +
  "don't invent them.\n" +
  "- TAGS & PRIORITY: apply these by discretion, not reflex. Add a tag or a `priority` only " +
  "when it truly helps organize or flags what matters; a small, focused task may warrant " +
  "neither. Never blanket-tag every topic or mark everything p1.\n\n" +
  "Example — user: \"make a project called Garden with a topic for soil prep\":\n" +
  '{"reply":"I\'ll create a Garden project with a fleshed-out Soil prep topic.","actions":[' +
  '{"type":"createProject","tempId":"p1","name":"Garden"},' +
  '{"type":"createTopic","tempId":"t1","projectId":"p1","title":"Soil prep",' +
  '"summary":"Get the beds ready before the first planting.","decisions":[' +
  '{"title":"Test soil pH before amending","note":"A cheap kit now avoids re-doing beds later."},' +
  '{"title":"Amend with two inches of compost","note":"Raises organic matter without over-fertilizing."},' +
  '{"title":"Solarize the weedy back bed","note":"Four weeks under clear plastic kills seeds without herbicide."}]}]}';

const BUILD_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "createProject",
              "updateProject",
              "deleteProject",
              "moveProject",
              "createTopic",
              "updateTopic",
              "deleteTopic",
              "createDecision",
              "updateDecision",
              "deleteDecision",
              "createLink",
              "deleteLink",
            ],
          },
          tempId: { type: "string" },
          spaceId: { type: "string" },
          targetSpaceId: { type: "string" },
          projectId: { type: "string" },
          topicId: { type: "string" },
          decisionId: { type: "string" },
          outbound: { type: "string" },
          inbound: { type: "string" },
          name: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          tagline: { type: "string" },
          note: { type: "string" },
          color: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          issueUrl: { type: "string" },
          position: { type: "number" },
          tone: { type: "string", enum: TONES },
          priority: { type: ["string", "null"], enum: [...PRIORITIES, null] },
          tags: { type: "array", items: { type: "string" } },
          decisions: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" }, note: { type: "string" } },
              required: ["title"],
            },
          },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
} as const;

export async function sendChatMessage(
  history: ChatTurn[],
  mode: ChatMode = "plan",
  contextProjectIds?: string[],
  hookIds?: string[],
): Promise<ChatResult> {
  const turns = dropLeadingAssistant(history).filter((t) => t.content.trim());
  if (turns.length === 0) return { ok: false, error: "Nothing to send." };

  const cfg = await getAllConfig();
  try {
    const mcf = await loadWorkspaceMCF(contextProjectIds);
    const hooks = await loadHookBlock(hookIds);
    return mode === "build"
      ? await runBuild(turns, mcf, cfg, hooks)
      : await runPlan(turns, mcf, cfg, hooks);
  } catch (err) {
    return { ok: false, error: friendlyProviderError(err) };
  }
}

async function runPlan(
  turns: ChatTurn[],
  mcf: string,
  cfg: Record<string, string>,
  hooks: string,
): Promise<ChatResult> {
  const system = [PLAN_SYSTEM, hooks, contextBlock(mcf)].filter(Boolean).join("\n\n");

  if (cfg.ai_provider === "claude_cli") {
    const res = await callClaudeCli(flattenForClaude(system, turns), cfg);
    const text = res.text.trim();
    const model = res.model ?? undefined;
    const alias = (cfg.claude_model || "").trim();
    if (model && alias) await setClaudeModelVersion(alias, model);
    return text
      ? { ok: true, reply: text, model, usage: res.usage }
      : { ok: false, error: "The model returned an empty response." };
  }

  const res = await callOllamaDetailed([{ role: "system", content: system }, ...turns], cfg);
  const text = res.text.trim();
  return text
    ? { ok: true, reply: text, usage: res.usage }
    : { ok: false, error: "The model returned an empty response." };
}

async function runBuild(
  turns: ChatTurn[],
  mcf: string,
  cfg: Record<string, string>,
  hooks: string,
): Promise<ChatResult> {
  const system = [BUILD_SYSTEM, hooks].filter(Boolean).join("\n\n");
  const userPrompt = [
    contextBlock(mcf),
    "",
    "CONVERSATION:",
    transcript(turns),
    "",
    "Respond with `reply` (a short message to the user) and `actions` (the changes to " +
      "apply, or an empty array if none).",
  ].join("\n");

  const first = await generateStructuredDetailed(cfg, system, userPrompt, BUILD_SCHEMA);
  let usage = first.usage;
  let { reply, actions } = parseBuildResponse(first.data);

  if (actions.length === 0 && promisesChanges(reply)) {
    const retryPrompt = [
      userPrompt,
      "",
      `You just replied "${reply}" but returned an EMPTY actions array, so NOTHING will ` +
        "change — that is a failure. Answer again with the same intent, but this time the " +
        "`actions` array MUST contain every create/update needed to carry it out. Reference " +
        "existing records by the exact ids in the WORKSPACE context. Do not promise future work.",
    ].join("\n");
    const second = await generateStructuredDetailed(cfg, system, retryPrompt, BUILD_SCHEMA);
    usage = addUsage(usage, second.usage);
    const retry = parseBuildResponse(second.data);
    if (retry.actions.length > 0) ({ reply, actions } = retry);
  }

  return {
    ok: true,
    reply,
    actions,
    usage,
    noActionsWarning: actions.length === 0 && promisesChanges(reply),
  };
}

async function loadHookBlock(hookIds?: string[]): Promise<string> {
  if (!hookIds?.length) return "";
  const wanted = new Set(hookIds);
  const hooks = (await getChatHooks()).filter((h) => wanted.has(h.id));
  if (!hooks.length) return "";
  return [
    "HOOKS — extra standing instructions the user switched on for this chat. Follow " +
      "them alongside everything above; if one asks you to use a tool or MCP server you " +
      "don't have, say so plainly instead of pretending you used it.",
    ...hooks.map((h) => `- ${h.name}: ${h.prompt}`),
  ].join("\n");
}

export async function applyChatActions(
  actions: ChatAction[],
  defaults?: { spaceId?: string | null; projectId?: string | null },
): Promise<ApplyResult> {
  try {
    const user = await getOrCreateDefaultUser();
    const bundle = await getWorkspaceBundle(user.id);

    const projectCount = new Map<string, number>();
    const topicCount = new Map<string, number>();
    const decisionCount = new Map<string, number>();
    const knownSpaces = new Set<string>();
    const knownProjects = new Set<string>();
    const knownTopics = new Set<string>();
    for (const s of bundle) {
      knownSpaces.add(s.id);
      projectCount.set(s.id, s.projects.length);
      for (const p of s.projects) {
        knownProjects.add(p.id);
        topicCount.set(p.id, p.topics.length);
        for (const t of p.topics) {
          knownTopics.add(t.id);
          decisionCount.set(t.id, t.decisions.length);
        }
      }
    }

    const refs = new Map<string, string>();
    const resolve = (id?: string) => (id && refs.get(id)) || id || "";

    const fallbackSpaceId =
      (defaults?.spaceId && knownSpaces.has(defaults.spaceId) ? defaults.spaceId : bundle[0]?.id) ??
      null;

    const isLink = (a: ChatAction) => a.type === "createLink" || a.type === "deleteLink";
    const ordered = [...actions].sort((a, b) => (isLink(a) ? 1 : 0) - (isLink(b) ? 1 : 0));

    for (const action of ordered) {
      switch (action.type) {
        case "createProject": {
          const spaceId =
            (action.spaceId && knownSpaces.has(action.spaceId) ? action.spaceId : null) ??
            fallbackSpaceId;
          if (!spaceId) break;
          const id = crypto.randomUUID();
          const position = projectCount.get(spaceId) ?? 0;
          projectCount.set(spaceId, position + 1);
          await createProject({
            id,
            spaceId,
            name: action.name,
            tagline: action.tagline,
            color: action.color,
            position,
          });
          knownProjects.add(id);
          topicCount.set(id, 0);
          if (action.tempId) refs.set(action.tempId, id);
          break;
        }
        case "updateProject": {
          const id = resolve(action.projectId);
          if (!knownProjects.has(id)) break;
          await updateProject(id, {
            name: action.name,
            tagline: action.tagline,
            color: action.color,
          });
          break;
        }
        case "deleteProject": {
          const id = resolve(action.projectId);
          if (!knownProjects.has(id)) break;
          await deleteProject(id);
          break;
        }
        case "moveProject": {
          const id = resolve(action.projectId);
          if (!knownProjects.has(id) || !knownSpaces.has(action.targetSpaceId)) break;
          const position =
            action.position ?? projectCount.get(action.targetSpaceId) ?? 0;
          projectCount.set(action.targetSpaceId, (projectCount.get(action.targetSpaceId) ?? 0) + 1);
          await moveProject({ id, targetSpaceId: action.targetSpaceId, position });
          break;
        }
        case "createTopic": {
          const projectId = resolve(action.projectId) || (defaults?.projectId ?? "");
          if (!knownProjects.has(projectId)) break;
          const id = crypto.randomUUID();
          const position = topicCount.get(projectId) ?? 0;
          topicCount.set(projectId, position + 1);
          const decs = (action.decisions ?? []).map((d, i) => ({
            id: crypto.randomUUID(),
            title: d.title,
            note: d.note ?? "",
            position: i,
          }));
          await createTopic({
            id,
            projectId,
            title: action.title,
            summary: action.summary ?? "",
            tone: coerceTone(action.tone),
            priority: coercePriority(action.priority),
            tags: action.tags ?? [],
            collapsed: false,
            position,
            startDate: action.startDate,
            endDate: action.endDate,
            issueUrl: action.issueUrl,
            decisions: decs,
          });
          knownTopics.add(id);
          decisionCount.set(id, decs.length);
          if (action.tempId) refs.set(action.tempId, id);
          break;
        }
        case "updateTopic": {
          const id = resolve(action.topicId);
          if (!knownTopics.has(id)) break;
          await updateTopic(id, {
            title: action.title,
            summary: action.summary,
            tone: action.tone ? coerceTone(action.tone) : undefined,
            priority: action.priority === undefined ? undefined : coercePriority(action.priority),
            tags: action.tags,
            startDate: action.startDate,
            endDate: action.endDate,
            issueUrl: action.issueUrl,
          });
          break;
        }
        case "deleteTopic": {
          const id = resolve(action.topicId);
          if (!knownTopics.has(id)) break;
          await deleteTopic(id);
          break;
        }
        case "createDecision": {
          const topicId = resolve(action.topicId);
          if (!knownTopics.has(topicId)) break;
          const id = crypto.randomUUID();
          const position = decisionCount.get(topicId) ?? 0;
          decisionCount.set(topicId, position + 1);
          await addDecision({ id, topicId, title: action.title, note: action.note, position });
          break;
        }
        case "updateDecision": {
          if (!action.decisionId) break;
          await updateDecision(action.decisionId, { title: action.title, note: action.note });
          break;
        }
        case "deleteDecision": {
          if (!action.decisionId) break;
          await deleteDecision(action.decisionId);
          break;
        }
        case "createLink": {
          const outbound = resolve(action.outbound);
          const inbound = resolve(action.inbound);
          if (!knownTopics.has(outbound) || !knownTopics.has(inbound) || outbound === inbound) break;
          await createLink(outbound, inbound);
          break;
        }
        case "deleteLink": {
          const outbound = resolve(action.outbound);
          const inbound = resolve(action.inbound);
          if (!outbound || !inbound) break;
          await deleteLink(outbound, inbound);
          break;
        }
      }
    }

    return { ok: true, spaces: await getWorkspaceBundle(user.id) };
  } catch (err) {
    return { ok: false, error: friendlyProviderError(err) };
  }
}

async function loadWorkspaceMCF(projectIds?: string[]): Promise<string> {
  const user = await getOrCreateDefaultUser();
  let spaces = await getWorkspaceBundle(user.id);
  if (projectIds && projectIds.length) {
    const keep = new Set(projectIds);
    spaces = spaces
      .map((s) => ({ ...s, projects: s.projects.filter((p) => keep.has(p.id)) }))
      .filter((s) => s.projects.length > 0);
  }
  return serializeWorkspaceToMCF(spaces);
}

const contextBlock = (mcf: string) =>
  `WORKSPACE — current state in MCF. IDs are inline; reference them exactly to target existing records:\n\n${mcf}`;

const transcript = (turns: ChatTurn[]) =>
  turns.map((t) => `${t.role === "assistant" ? "Assistant" : "User"}: ${t.content}`).join("\n\n");

const flattenForClaude = (system: string, turns: ChatTurn[]) =>
  [system, "", transcript(turns), "", "Assistant:"].join("\n");

function promisesChanges(reply: string): boolean {
  const r = reply.trim();
  if (!r || r.endsWith("?")) return false;
  return /\b(i['’]?ll|i will|i['’]?m going to|let me|going to|here['’]?s what|populate|add|create|update|draft|fill in|set up|build out|rename|delete|move|link)\b/i.test(r);
}

function parseBuildResponse(raw: unknown): { reply: string; actions: ChatAction[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
  const actions = rawActions
    .map(parseAction)
    .filter((a): a is ChatAction => a !== null);
  return {
    reply: reply || (actions.length ? "Here's what I can change:" : "Could you say a bit more about what you'd like to do?"),
    actions,
  };
}

function parseAction(raw: unknown): ChatAction | null {
  const a = (raw ?? {}) as Record<string, unknown>;
  const type = typeof a.type === "string" ? a.type : "";
  switch (type) {
    case "createProject": {
      const name = str(a.name);
      return name
        ? { type, name, tempId: str(a.tempId), spaceId: str(a.spaceId), tagline: str(a.tagline), color: hexColor(a.color) }
        : null;
    }
    case "updateProject": {
      const projectId = str(a.projectId);
      return projectId
        ? { type, projectId, name: str(a.name), tagline: str(a.tagline), color: hexColor(a.color) }
        : null;
    }
    case "deleteProject": {
      const projectId = str(a.projectId);
      return projectId ? { type, projectId } : null;
    }
    case "moveProject": {
      const projectId = str(a.projectId);
      const targetSpaceId = str(a.targetSpaceId);
      if (!projectId || !targetSpaceId) return null;
      return { type, projectId, targetSpaceId, position: typeof a.position === "number" ? a.position : undefined };
    }
    case "createTopic": {
      const title = str(a.title);
      if (!title) return null;
      return {
        type,
        title,
        projectId: str(a.projectId) ?? "",
        tempId: str(a.tempId),
        summary: str(a.summary),
        tone: TONES.includes(str(a.tone) as Tone) ? (str(a.tone) as Tone) : undefined,
        priority: priorityField(a.priority),
        tags: strArr(a.tags),
        startDate: str(a.startDate),
        endDate: str(a.endDate),
        issueUrl: str(a.issueUrl),
        decisions: decisionList(a.decisions),
      };
    }
    case "updateTopic": {
      const topicId = str(a.topicId);
      if (!topicId) return null;
      return {
        type,
        topicId,
        title: str(a.title),
        summary: str(a.summary),
        tone: TONES.includes(str(a.tone) as Tone) ? (str(a.tone) as Tone) : undefined,
        priority: priorityField(a.priority),
        tags: strArr(a.tags),
        startDate: nullableStr(a.startDate),
        endDate: nullableStr(a.endDate),
        issueUrl: nullableStr(a.issueUrl),
      };
    }
    case "deleteTopic": {
      const topicId = str(a.topicId);
      return topicId ? { type, topicId } : null;
    }
    case "createDecision": {
      const topicId = str(a.topicId);
      const title = str(a.title);
      return topicId && title ? { type, topicId, title, note: str(a.note) } : null;
    }
    case "updateDecision": {
      const decisionId = str(a.decisionId);
      return decisionId ? { type, decisionId, title: str(a.title), note: str(a.note) } : null;
    }
    case "deleteDecision": {
      const decisionId = str(a.decisionId);
      return decisionId ? { type, decisionId } : null;
    }
    case "createLink":
    case "deleteLink": {
      const outbound = str(a.outbound);
      const inbound = str(a.inbound);
      return outbound && inbound ? { type, outbound, inbound } : null;
    }
    default:
      return null;
  }
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

const nullableStr = (v: unknown): string | null | undefined =>
  v === null ? null : str(v);

const hexColor = (v: unknown): string | undefined => {
  const s = str(v);
  return s && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : undefined;
};

const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : undefined;

function decisionList(v: unknown): { title: string; note?: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: { title: string; note?: string }[] = [];
  for (const d of v) {
    const rec = (d ?? {}) as Record<string, unknown>;
    const title = str(rec.title);
    if (title) out.push({ title, note: str(rec.note) });
  }
  return out.length ? out : undefined;
}

function priorityField(v: unknown): Priority | null | undefined {
  if (v === null) return null;
  const s = typeof v === "string" ? v.trim() : "";
  return (PRIORITIES as readonly string[]).includes(s) ? (s as Priority) : undefined;
}

const coerceTone = (t?: string): Tone =>
  t && (TONES as readonly string[]).includes(t) ? (t as Tone) : "ink";

const coercePriority = (p?: Priority | null): Priority | null =>
  p && (PRIORITIES as readonly string[]).includes(p) ? p : null;

function dropLeadingAssistant(turns: ChatTurn[]): ChatTurn[] {
  let i = 0;
  while (i < turns.length && turns[i].role === "assistant") i++;
  return turns.slice(i);
}
