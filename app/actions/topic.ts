"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { topics, decisions } from "@/lib/db/schema";
import { nz } from "@/lib/types";
import type { Decision, Tone, Priority } from "@/lib/types";

type TopicPatch = {
  title?: string;
  summary?: string;
  tone?: Tone;
  priority?: Priority | null;
  tags?: string[];
  collapsed?: boolean;
  position?: number;
  startDate?: string | null;
  endDate?: string | null;
  issueUrl?: string | null;
};

type NewTopicInput = {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  tone: Tone;
  priority: Priority | null;
  tags: string[];
  collapsed: boolean;
  position: number;
  startDate?: string;
  endDate?: string;
  issueUrl?: string;
  decisions: { id: string; title: string; note: string; position: number }[];
};

export async function createTopic(input: NewTopicInput): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(topics).values({
      id: input.id,
      projectId: input.projectId,
      title: input.title,
      summary: input.summary,
      tone: input.tone,
      priority: input.priority,
      tags: input.tags,
      collapsed: input.collapsed,
      position: input.position,
      startDate: nz(input.startDate),
      endDate: nz(input.endDate),
      issueUrl: nz(input.issueUrl),
    });
    if (input.decisions.length) {
      await tx.insert(decisions).values(
        input.decisions.map((d) => ({
          id: d.id,
          topicId: input.id,
          title: d.title,
          note: d.note,
          position: d.position,
        })),
      );
    }
  });
}

export async function updateTopic(id: string, fields: TopicPatch): Promise<void> {
  const set: Record<string, unknown> = {};
  if (fields.title !== undefined) set.title = fields.title;
  if (fields.summary !== undefined) set.summary = fields.summary;
  if (fields.tone !== undefined) set.tone = fields.tone;
  if (fields.priority !== undefined) set.priority = fields.priority;
  if (fields.tags !== undefined) set.tags = fields.tags;
  if (fields.collapsed !== undefined) set.collapsed = fields.collapsed;
  if (fields.position !== undefined) set.position = fields.position;
  if (fields.startDate !== undefined) set.startDate = nz(fields.startDate);
  if (fields.endDate !== undefined) set.endDate = nz(fields.endDate);
  if (fields.issueUrl !== undefined) set.issueUrl = nz(fields.issueUrl);
  if (Object.keys(set).length === 0) return;
  await getDb().update(topics).set(set).where(eq(topics.id, id));
}

export async function deleteTopic(id: string): Promise<void> {
  await getDb().delete(topics).where(eq(topics.id, id));
}

export async function addDecision(input: {
  id: string;
  topicId: string;
  title: string;
  note?: string;
  position: number;
}): Promise<void> {
  await getDb().insert(decisions).values({
    id: input.id,
    topicId: input.topicId,
    title: input.title,
    note: input.note ?? "",
    position: input.position,
  });
}

export async function updateDecision(id: string, fields: Partial<Decision>): Promise<void> {
  const set: Record<string, unknown> = {};
  if (fields.title !== undefined) set.title = fields.title;
  if (fields.note !== undefined) set.note = fields.note;
  if (fields.position !== undefined) set.position = fields.position;
  if (Object.keys(set).length === 0) return;
  await getDb().update(decisions).set(set).where(eq(decisions.id, id));
}

export async function deleteDecision(id: string): Promise<void> {
  await getDb().delete(decisions).where(eq(decisions.id, id));
}
