"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Flag, SquareArrowOutUpRight, Copy, Check, Mouse } from "lucide-react";
import { Topic, ProjectLink, Tone, Priority, TONES, PRIORITY_META, TONE_META, MONTHS_SHORT } from "@/lib/types";
import { DocSyntaxHelp } from "./DocSyntaxHelp";
import { buildMarkdown } from "@/lib/export";

const toneMeta = (t: string | null) => TONE_META[(t ?? "ink") as Tone] ?? TONE_META.ink;
const toneDeep = (t: string | null) => toneMeta(t).deep;

function fmtDate(s?: string | null): string | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}
function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
const pad2 = (n: number) => String(n).padStart(2, "0");

export interface ParsedDecision {
  title: string;
  note: string;
}
export interface ParsedTopic {
  title: string;
  summary: string;
  tone: Tone | null;
  priority: Priority | null;
  tags: string[];
  startDate: string | null;
  endDate: string | null;
  issueUrl: string | null;
  decisions: ParsedDecision[];
}
export interface ParsedLink {
  from: number;
  to: number;
}
export interface ParsedDoc {
  title: string;
  tagline: string;
  topics: ParsedTopic[];
  links: ParsedLink[];
}

function parseDoc(md: string): ParsedDoc {
  const lines = md.split("\n");
  let title = "";
  let tagline = "";
  const topics: ParsedTopic[] = [];
  const links: ParsedLink[] = [];
  let current: ParsedTopic | null = null;
  let mode: "topic" | "links" = "topic";
  let summaryParts: string[] = [];

  const flushSummary = () => {
    if (current && summaryParts.length) {
      current.summary = summaryParts.join(" ").replace(/\s+/g, " ").trim();
    }
    summaryParts = [];
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith("## ")) {
      flushSummary();
      const heading = t.slice(3).trim();
      if (/^linkages$/i.test(heading)) {
        mode = "links";
        current = null;
        continue;
      }
      mode = "topic";
      const m = heading.match(/^(\d+)\.\s*(.*)$/);
      current = {
        title: (m ? m[2] : heading).trim(),
        summary: "",
        tone: null,
        priority: null,
        tags: [],
        startDate: null,
        endDate: null,
        issueUrl: null,
        decisions: [],
      };
      topics.push(current);
    } else if (t.startsWith("# ")) {
      title = t.slice(2).trim();
    } else if (t.startsWith("> ")) {
      tagline = t.slice(2).trim();
    } else if (mode === "links" && (t.startsWith("- ") || t.startsWith("* ") || /^\d/.test(t))) {
      const m = t.replace(/^[-*]\s*/, "").match(/(\d+)\s*(?:→|->)\s*(\d+)/);
      if (m) links.push({ from: Number(m[1]), to: Number(m[2]) });
    } else if (t.startsWith("@") && current) {
      const m = t.match(/^@(\w+)\s+(.*)$/);
      if (m) {
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === "tone") current.tone = TONES.includes(val as Tone) ? (val as Tone) : null;
        else if (key === "priority") {
          const p = val.toLowerCase();
          current.priority = (["p1", "p2", "p3", "p4"].includes(p) ? p : null) as Priority | null;
        } else if (key === "tags") {
          current.tags = val.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean);
        } else if (key === "timeline") {
          const [s, e] = val.split(/→|->/).map((x) => x.trim());
          current.startDate = s || null;
          current.endDate = e || null;
        } else if (key === "issue") {
          current.issueUrl = val || null;
        }
      }
    } else if (mode === "topic" && (t.startsWith("- ") || t.startsWith("* ")) && current) {
      const item = t.slice(2);
      const sep = item.match(/\s+(?:—|–|--)\s+/);
      current.decisions.push(
        sep
          ? { title: item.slice(0, sep.index!).trim(), note: item.slice(sep.index! + sep[0].length).trim() }
          : { title: item.trim(), note: "" }
      );
    } else if (t.startsWith("### ") || t === "") {
    } else if (mode === "topic" && current && current.decisions.length === 0) {
      summaryParts.push(t);
    }
  }
  flushSummary();
  return { title, tagline, topics, links };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function FactsLine({ topic }: { topic: ParsedTopic }) {
  const start = fmtDate(topic.startDate);
  const end = fmtDate(topic.endDate);
  const pr = topic.priority ? PRIORITY_META[topic.priority] : null;

  const items: React.ReactNode[] = [];
  if (pr) {
    items.push(
      <span key="pr" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: pr.color, fontWeight: 500 }}>
        <Flag size={11} style={{ fill: pr.color, color: pr.color }} />
        {pr.label}
      </span>
    );
  }
  if (start || end) {
    items.push(
      <span key="dates" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums", color: "var(--doc-ink-3)" }}>
        {start ?? "—"}<ArrowRight size={11} style={{ opacity: 0.5 }} />{end ?? "—"}
      </span>
    );
  }
  if (topic.issueUrl) {
    const href = /^https?:\/\//i.test(topic.issueUrl) ? topic.issueUrl : `https://${topic.issueUrl}`;
    items.push(
      <a key="issue" className="doc-link" href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {hostOf(topic.issueUrl)}<SquareArrowOutUpRight size={10} style={{ opacity: 0.6 }} />
      </a>
    );
  }
  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", marginTop: 8, fontSize: 12.5, fontFamily: "var(--sans)", lineHeight: 1.6 }}>
      {items.map((node, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span aria-hidden style={{ color: "var(--doc-ink-4)", margin: "0 9px" }}>·</span>}
          {node}
        </span>
      ))}
    </div>
  );
}

function TopicCard({ topic, index, first }: { topic: ParsedTopic; index: number; first: boolean }) {
  const hasFacts = !!(topic.priority || topic.startDate || topic.endDate || topic.issueUrl);

  return (
    <section style={{
      borderTop: first ? undefined : "1px solid var(--doc-rule)",
      marginTop: first ? 0 : 30,
      paddingTop: first ? 0 : 30,
    }}>
      <h2 style={{
        margin: 0,
        fontFamily: "var(--sans)",
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: 1.3,
        color: toneDeep(topic.tone),
      }}>
        <span style={{ color: "var(--doc-ink-4)", fontVariantNumeric: "tabular-nums" }}>
          {pad2(index + 1)} -{" "}
        </span>
        {topic.title || <span style={{ color: "var(--doc-ink-4)", fontStyle: "italic", fontWeight: 400 }}>Untitled</span>}
      </h2>

      <FactsLine topic={topic} />

      {topic.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: hasFacts ? 7 : 8, fontSize: 12.5, fontFamily: "var(--sans)", color: "var(--doc-ink-3)" }}>
          {topic.tags.map((t) => <span key={t}>#{t}</span>)}
        </div>
      )}

      {topic.summary && (
        <p style={{ margin: "13px 0 0", maxWidth: "64ch", fontSize: 15.5, lineHeight: 1.7, color: "var(--doc-ink-2)" }}>
          {topic.summary}
        </p>
      )}

      {topic.decisions.length > 0 && (
        <ol style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
          {topic.decisions.map((d, j) => (
            <li key={j} style={{ display: "flex", gap: 11 }}>
              <span style={{
                flexShrink: 0,
                width: 14,
                textAlign: "right",
                fontFamily: "var(--mono)",
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--doc-ink-4)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: "23px",
              }}>
                {j + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--doc-ink)" }}>
                  {d.title}
                </div>
                {d.note && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--doc-ink-3)", marginTop: 3 }}>
                    {d.note}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LinkRef({ topic, index }: { topic: ParsedTopic | undefined; index: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, minWidth: 0, maxWidth: 260 }}>
      <span style={{
        fontFamily: "var(--mono)",
        fontSize: 12,
        fontWeight: 600,
        color: topic ? toneDeep(topic.tone) : "var(--doc-ink-4)",
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}>
        {pad2(index)}
      </span>
      <span style={{
        fontSize: 14,
        color: topic ? "var(--doc-ink)" : "var(--doc-ink-4)",
        fontStyle: topic ? "normal" : "italic",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {topic ? (topic.title || "Untitled") : "missing"}
      </span>
    </span>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  const doc = parseDoc(content);
  const topicCount = doc.topics.length;
  const decisionCount = doc.topics.reduce((n, t) => n + t.decisions.length, 0);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "72px clamp(24px, 5vw, 40px) 160px" }}>
      {topicCount > 0 && (
        <div style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--doc-ink-3)",
          marginBottom: 14,
        }}>
          {topicCount} {topicCount === 1 ? "topic" : "topics"} · {decisionCount} {decisionCount === 1 ? "decision" : "decisions"}
        </div>
      )}

      <h1 style={{
        fontFamily: "var(--serif)",
        fontSize: 50,
        fontWeight: 400,
        color: "var(--doc-ink)",
        margin: 0,
        letterSpacing: "-0.03em",
        lineHeight: 1.05,
      }}>
        {doc.title || <span style={{ color: "var(--doc-ink-4)", fontStyle: "italic" }}>Untitled project</span>}
      </h1>

      {doc.tagline && (
        <p style={{
          margin: "14px 0 0",
          maxWidth: "42rem",
          fontFamily: "var(--sans)",
          fontSize: 16.5,
          fontWeight: 400,
          lineHeight: 1.6,
          color: "var(--doc-ink-3)",
        }}>
          {doc.tagline}
        </p>
      )}

      <div style={{ borderTop: "1px solid var(--doc-rule)", marginTop: doc.tagline ? 36 : 40 }} />

      <div style={{ marginTop: 32 }}>
        {doc.topics.map((topic, i) => (
          <TopicCard key={i} topic={topic} index={i} first={i === 0} />
        ))}
      </div>

      {doc.links.length > 0 && (
        <div style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid var(--doc-rule)" }}>
          <h3 style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--doc-ink-3)",
            margin: "0 0 16px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Linkages
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {doc.links.map((edge, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <LinkRef topic={doc.topics[edge.from - 1]} index={edge.from} />
                <ArrowRight size={14} style={{ color: "var(--doc-ink-4)", flexShrink: 0 }} />
                <LinkRef topic={doc.topics[edge.to - 1]} index={edge.to} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const LINE_PX = 21;

interface Props {
  projectTitle: string;
  projectTagline?: string;
  topics: Topic[];
  links?: ProjectLink[];
  onSync?: (doc: ParsedDoc) => void;
}

type SyncState = "synced" | "edited" | "saving";

export function DocPanel({ projectTitle, projectTagline, topics, links = [], onSync }: Props) {
  const [content, setContent] = useState(() => buildMarkdown(projectTitle, topics, { tagline: projectTagline, links }));
  const [status, setStatus] = useState<SyncState>("synced");
  const [copied, setCopied] = useState(false);
  const [scrollSync, setScrollSync] = useState(true);
  const [caret, setCaret] = useState({ line: 1, col: 1 });

  const [editorPct, setEditorPct] = useState(50);
  const [splitDragging, setSplitDragging] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollLock = useRef<"editor" | "preview" | null>(null);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const lines = content.split("\n");
  const words = wordCount(content);

  const pushSync = useCallback(() => {
    const parsed = parseDoc(content);
    if (!parsed.title.trim() && parsed.topics.length === 0) {
      setStatus("synced");
      return;
    }
    onSyncRef.current?.(parsed);
    setStatus("synced");
  }, [content]);

  useEffect(() => {
    if (status !== "edited") return;
    const id = setTimeout(() => {
      setStatus("saving");
      pushSync();
    }, 650);
    return () => clearTimeout(id);
  }, [content, status, pushSync]);

  useEffect(() => {
    if (!splitDragging) return;
    const move = (e: PointerEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setEditorPct(Math.min(75, Math.max(25, pct)));
    };
    const stop = () => setSplitDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [splitDragging]);

  const updateCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const upto = el.value.slice(0, el.selectionStart);
    const segs = upto.split("\n");
    setCaret({ line: segs.length, col: segs[segs.length - 1].length + 1 });
  }, []);

  const edit = (next: string, caretPos?: number) => {
    setContent(next);
    setStatus("edited");
    if (caretPos !== undefined) {
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.selectionStart = el.selectionEnd = caretPos;
          updateCaret();
        }
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setStatus("edited");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const { selectionStart, selectionEnd, value } = el;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      setStatus("saving");
      pushSync();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const next = value.slice(0, selectionStart) + "  " + value.slice(selectionEnd);
      edit(next, selectionStart + 2);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && selectionStart === selectionEnd) {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const line = value.slice(lineStart, selectionStart);
      const m = line.match(/^(\s*)([-*])\s+(.*)$/);
      if (m) {
        if (m[3].trim() === "") {
          e.preventDefault();
          const next = value.slice(0, lineStart) + value.slice(selectionStart);
          edit(next, lineStart);
        } else {
          e.preventDefault();
          const insert = `\n${m[1]}${m[2]} `;
          const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
          edit(next, selectionStart + insert.length);
        }
        return;
      }
    }
  };

  const syncLineNumbers = () => {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleEditorScroll = () => {
    syncLineNumbers();
    if (!scrollSync) return;
    if (scrollLock.current === "preview") { scrollLock.current = null; return; }
    const ed = textareaRef.current;
    const pv = previewRef.current;
    if (!ed || !pv) return;
    const edMax = ed.scrollHeight - ed.clientHeight;
    const pvMax = pv.scrollHeight - pv.clientHeight;
    if (edMax <= 0) return;
    scrollLock.current = "editor";
    pv.scrollTop = (ed.scrollTop / edMax) * pvMax;
  };

  const handlePreviewScroll = () => {
    if (!scrollSync) return;
    if (scrollLock.current === "editor") { scrollLock.current = null; return; }
    const ed = textareaRef.current;
    const pv = previewRef.current;
    if (!ed || !pv) return;
    const pvMax = pv.scrollHeight - pv.clientHeight;
    const edMax = ed.scrollHeight - ed.clientHeight;
    if (pvMax <= 0) return;
    scrollLock.current = "preview";
    ed.scrollTop = (pv.scrollTop / pvMax) * edMax;
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [content]);

  const statusMeta: Record<SyncState, { color: string; label: string }> = {
    synced: { color: "var(--sage)", label: "synced" },
    edited: { color: "var(--butter)", label: "unsaved" },
    saving: { color: "var(--peri)", label: "saving" },
  };
  const sm = statusMeta[status];

  return (
    <div ref={splitRef} style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{
        flexBasis: `${editorPct}%`,
        flexGrow: 0,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 14px",
          height: 40,
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
          background: "var(--paper-2)",
        }}>
          <span style={{
            fontSize: 11.5,
            fontFamily: "var(--mono)",
            fontWeight: 500,
            color: "var(--ink-3)",
            letterSpacing: "0.02em",
            userSelect: "none",
          }}>
            .md
          </span>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setScrollSync((v) => !v)}
            title={scrollSync ? "Scroll sync on — click to turn off" : "Scroll sync off — click to turn on"}
            aria-pressed={scrollSync}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500,
              border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer",
              background: scrollSync ? "var(--forest-soft)" : "transparent",
              color: scrollSync ? "var(--forest)" : "var(--ink-3)",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              if (scrollSync) return;
              e.currentTarget.style.background = "var(--paper-3)";
              e.currentTarget.style.color = "var(--ink-2)";
            }}
            onMouseLeave={(e) => {
              if (scrollSync) return;
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-3)";
            }}
          >
            <Mouse size={13} style={{ flexShrink: 0 }} />
            Scroll sync
          </button>

          <DocSyntaxHelp />

          <button
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy markdown"}
            aria-label={copied ? "Copied" : "Copy markdown"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "none", borderRadius: 6, padding: 5, cursor: "pointer",
              background: "transparent",
              color: copied ? "var(--sage)" : "var(--ink-3)",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              if (copied) return;
              e.currentTarget.style.background = "var(--paper-3)";
              e.currentTarget.style.color = "var(--ink-2)";
            }}
            onMouseLeave={(e) => {
              if (copied) return;
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-3)";
            }}
          >
            {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} />}
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            ref={lineNumRef}
            style={{
              width: 48,
              flexShrink: 0,
              overflowY: "hidden",
              paddingTop: 18,
              paddingBottom: 18,
              background: "var(--paper-2)",
              borderRight: "1px solid var(--line)",
              userSelect: "none",
            }}
          >
            {lines.map((_, i) => (
              <div
                key={i}
                style={{
                  textAlign: "right",
                  paddingRight: 12,
                  height: LINE_PX,
                  lineHeight: `${LINE_PX}px`,
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  color: caret.line === i + 1 ? "var(--ink-2)" : "var(--ink-4)",
                  transition: "color 0.1s",
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleEditorScroll}
            onKeyUp={updateCaret}
            onClick={updateCaret}
            onSelect={updateCaret}
            spellCheck={false}
            wrap="off"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              padding: "18px 22px",
              fontFamily: "var(--mono)",
              fontSize: 13,
              lineHeight: `${LINE_PX}px`,
              color: "var(--ink)",
              background: "var(--paper)",
              overflow: "auto",
              whiteSpace: "pre",
              caretColor: "var(--coral)",
              tabSize: 2,
              fontVariantLigatures: "none",
              fontFeatureSettings: '"calt" 0, "liga" 0, "dlig" 0',
            }}
          />
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 26,
          padding: "0 14px",
          borderTop: "1px solid var(--line)",
          background: "var(--paper-2)",
          flexShrink: 0,
          userSelect: "none",
        }}>
          <span style={{
            fontSize: 10.5,
            fontFamily: "var(--mono)",
            color: "var(--ink-4)",
            letterSpacing: "0.02em",
            fontVariantNumeric: "tabular-nums",
          }}>
            Ln {caret.line}, Col {caret.col}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{
              fontSize: 10.5,
              fontFamily: "var(--mono)",
              color: "var(--ink-4)",
              letterSpacing: "0.02em",
            }}>
              {words.toLocaleString()} {words === 1 ? "word" : "words"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: sm.color,
                display: "inline-block",
                transition: "background 0.3s",
              }} />
              <span style={{
                fontSize: 10.5,
                fontFamily: "var(--mono)",
                color: sm.color,
                letterSpacing: "0.03em",
                transition: "color 0.3s",
              }}>
                {sm.label}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div
        className={"doc-split-gutter" + (splitDragging ? " is-dragging" : "")}
        onPointerDown={(e) => { e.preventDefault(); setSplitDragging(true); }}
        onDoubleClick={() => setEditorPct(50)}
        title="Drag to resize · double-click to reset"
      />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: "var(--paper)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          height: 40,
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
          background: "var(--paper-2)",
        }}>
          <span style={{
            fontSize: 11,
            fontFamily: "var(--mono)",
            color: "var(--ink-4)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            userSelect: "none",
          }}>
            preview
          </span>
        </div>

        <div ref={previewRef} onScroll={handlePreviewScroll} className="doc-page" style={{ flex: 1, overflowY: "auto" }}>
          <MarkdownPreview content={content} />
        </div>
      </div>
    </div>
  );
}
