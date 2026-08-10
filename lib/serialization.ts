import type { Space, Topic } from "@/lib/types";

export function serializeTopicToMCF(topic: Topic): string {
  const lines: string[] = [];
  const tags = topic.tags.length ? `[${topic.tags.join(",")}]` : "[]";
  const priority = topic.priority ?? "-";
  const title = topic.title.trim() || "(untitled)";
  lines.push(`TOPIC ${topic.id} | ${topic.tone} | ${priority} | ${tags} | ${title}`);

  const summary = topic.summary.trim();
  if (summary) lines.push(`  SUM ${flatten(summary)}`);

  const start = topic.startDate?.trim();
  const end = topic.endDate?.trim();
  if (start || end) lines.push(`  WHEN ${start || "?"} -> ${end || "?"}`);
  const issue = topic.issueUrl?.trim();
  if (issue) lines.push(`  ISSUE ${issue}`);

  for (const d of topic.decisions) {
    const decTitle = d.title.trim() || "(empty)";
    const head = `  DEC ${d.id} | ${decTitle}`;
    const note = d.note.trim();
    lines.push(note ? `${head} :: ${flatten(note)}` : head);
  }

  return lines.join("\n");
}

export function serializeWorkspaceToMCF(spaces: Space[]): string {
  if (!spaces.length) return "(empty workspace)";
  const lines: string[] = [];
  for (const space of spaces) {
    lines.push(`SPACE ${space.id} | ${space.name.trim() || "(unnamed)"}`);
    if (!space.projects.length) lines.push("  (no projects)");
    for (const project of space.projects) {
      const tagline = project.tagline.trim();
      const head = `PROJECT ${project.id} | ${project.name.trim() || "(untitled)"} | ${project.color}`;
      lines.push(tagline ? `${head} | ${flatten(tagline)}` : head);
      for (const topic of project.topics) lines.push(serializeTopicToMCF(topic));
      for (const link of project.links) lines.push(`LINK ${link.outbound} -> ${link.inbound}`);
    }
  }
  return lines.join("\n");
}

const flatten = (s: string) => s.replace(/\s+/g, " ");
