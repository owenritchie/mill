import type { Topic, ProjectLink } from "@/lib/types";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function buildMarkdown(
  title: string,
  topics: Topic[],
  opts: { tagline?: string; links?: ProjectLink[] } = {},
): string {
  const { tagline, links = [] } = opts;
  const lines: string[] = [`# ${title}`, ""];
  if (tagline) lines.push(`> ${tagline}`, "");

  topics.forEach((topic, i) => {
    lines.push(`## ${pad2(i + 1)}. ${topic.title}`);
    lines.push(`@tone ${topic.tone}`);
    if (topic.priority) lines.push(`@priority ${topic.priority.toUpperCase()}`);
    if (topic.tags?.length) lines.push(`@tags ${topic.tags.join(", ")}`);
    if (topic.startDate || topic.endDate) {
      const range = `${topic.startDate ?? ""} -> ${topic.endDate ?? ""}`.trim();
      lines.push(`@timeline ${range}`);
    }
    if (topic.issueUrl) lines.push(`@issue ${topic.issueUrl}`);
    lines.push("");
    if (topic.summary) lines.push(topic.summary, "");
    const decisions = topic.decisions.filter((d) => d.title.trim());
    decisions.forEach((d) => {
      const note = d.note?.trim() ? ` — ${d.note}` : "";
      lines.push(`- ${d.title}${note}`);
    });
    if (decisions.length) lines.push("");
  });

  const indexOf = new Map(topics.map((topic, i) => [topic.id, i + 1] as const));
  const edges = links
    .map((l) => [indexOf.get(l.outbound), indexOf.get(l.inbound)] as [number | undefined, number | undefined])
    .filter((e): e is [number, number] => !!e[0] && !!e[1]);
  if (edges.length) {
    lines.push("## Linkages", "");
    edges.forEach(([a, b]) => lines.push(`- ${pad2(a)} -> ${pad2(b)}`));
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
