"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projects, topics, decisions } from "@/lib/db/schema";
import { nz } from "@/lib/types";
import type { Tone, Priority } from "@/lib/types";

export async function createProject(input: {
  id: string;
  spaceId: string;
  name: string;
  tagline?: string;
  color?: string;
  position: number;
}): Promise<void> {
  await getDb().insert(projects).values({
    id: input.id,
    spaceId: input.spaceId,
    title: input.name,
    tagline: input.tagline ?? "",
    color: input.color ?? "#2A8C7A",
    position: input.position,
  });
}

export async function updateProject(
  id: string,
  fields: { name?: string; tagline?: string; color?: string },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (fields.name !== undefined) set.title = fields.name;
  if (fields.tagline !== undefined) set.tagline = fields.tagline;
  if (fields.color !== undefined) set.color = fields.color;
  if (Object.keys(set).length === 0) return;
  set.updatedAt = new Date();
  await getDb().update(projects).set(set).where(eq(projects.id, id));
}

export async function deleteProject(id: string): Promise<void> {
  await getDb().delete(projects).where(eq(projects.id, id));
}

export async function moveProject(input: {
  id: string;
  targetSpaceId: string;
  position: number;
}): Promise<void> {
  await getDb()
    .update(projects)
    .set({ spaceId: input.targetSpaceId, position: input.position, updatedAt: new Date() })
    .where(eq(projects.id, input.id));
}

type DeepTopic = {
  id: string;
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

export async function createProjectDeep(input: {
  id: string;
  spaceId: string;
  name: string;
  tagline: string;
  color: string;
  position: number;
  topics: DeepTopic[];
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: input.id,
      spaceId: input.spaceId,
      title: input.name,
      tagline: input.tagline,
      color: input.color,
      position: input.position,
    });
    for (const topic of input.topics) {
      await tx.insert(topics).values({
        id: topic.id,
        projectId: input.id,
        title: topic.title,
        summary: topic.summary,
        tone: topic.tone,
        priority: topic.priority,
        tags: topic.tags,
        collapsed: topic.collapsed,
        position: topic.position,
        startDate: nz(topic.startDate),
        endDate: nz(topic.endDate),
        issueUrl: nz(topic.issueUrl),
      });
      if (topic.decisions.length) {
        await tx.insert(decisions).values(
          topic.decisions.map((d) => ({
            id: d.id,
            topicId: topic.id,
            title: d.title,
            note: d.note,
            position: d.position,
          })),
        );
      }
    }
  });
}
