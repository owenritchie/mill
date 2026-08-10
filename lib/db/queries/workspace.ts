import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { spaces, links } from "@/lib/db/schema";
import type { Topic, ProjectLink, Space, SpaceProject } from "@/lib/types";

export async function getWorkspaceBundle(userId: string): Promise<Space[]> {
  const db = getDb();
  const allLinks = await db.select().from(links);
  const linksByTopic = new Map<string, ProjectLink[]>();
  for (const l of allLinks) {
    const bucket = linksByTopic.get(l.outbound) ?? [];
    bucket.push({ outbound: l.outbound, inbound: l.inbound });
    linksByTopic.set(l.outbound, bucket);
  }
  const rows = await db.query.spaces.findMany({
    where: eq(spaces.userId, userId),
    orderBy: [asc(spaces.position), asc(spaces.createdAt)],
    with: {
      projects: {
        orderBy: (p, { asc }) => [asc(p.position), asc(p.createdAt)],
        with: {
          topics: {
            orderBy: (i, { asc }) => [asc(i.position), asc(i.createdAt)],
            with: {
              decisions: {
                orderBy: (d, { asc }) => [asc(d.position), asc(d.createdAt)],
              },
            },
          },
        },
      },
    },
  });

  return rows.map(
    (space): Space => ({
      id: space.id,
      name: space.name,
      projects: space.projects.map(
        (p): SpaceProject => ({
          id: p.id,
          name: p.title,
          tagline: p.tagline,
          color: p.color,
          links: p.topics.flatMap((i) => linksByTopic.get(i.id) ?? []),
          topics: p.topics.map(
            (i): Topic => ({
              id: i.id,
              title: i.title,
              summary: i.summary,
              tone: i.tone,
              priority: i.priority,
              tags: i.tags,
              collapsed: i.collapsed,
              position: i.position,
              issueUrl: i.issueUrl ?? undefined,
              startDate: i.startDate ?? undefined,
              endDate: i.endDate ?? undefined,
              decisions: i.decisions.map((d) => ({
                id: d.id,
                title: d.title,
                note: d.note,
                position: d.position,
              })),
            }),
          ),
        }),
      ),
    }),
  );
}
