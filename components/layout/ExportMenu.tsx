"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileJson, FileText as FileMd, Sheet, Clipboard, Check } from "lucide-react";
import { Topic, ProjectLink } from "@/lib/types";
import { buildMarkdown, downloadFile } from "@/lib/export";

function exportCSV(topics: Topic[], title: string) {
  const rows: string[][] = [["Topic", "Summary", "Priority", "Tags", "Decision", "Note"]];
  for (const topic of topics) {
    if (topic.decisions.length === 0) {
      rows.push([topic.title, topic.summary, topic.priority ?? "", topic.tags.join("; "), "", ""]);
    } else {
      for (const d of topic.decisions) {
        rows.push([topic.title, topic.summary, topic.priority ?? "", topic.tags.join("; "), d.title, d.note]);
      }
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(`${title}.csv`, csv, "text/csv");
}

const EXPORT_OPTIONS: {
  label: string;
  description: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
  action: (topics: Topic[], title: string, opts: { tagline?: string; links?: ProjectLink[] }) => void;
}[] = [
  {
    label: "Markdown",
    description: "For docs & sharing",
    Icon: FileMd,
    color: "#2A8C7A",
    bg: "#C5E5DE",
    action: (topics, title, opts) => downloadFile(`${title}.md`, buildMarkdown(title, topics, opts), "text/markdown"),
  },
  {
    label: "JSON",
    description: "Raw structured data",
    Icon: FileJson,
    color: "#4A5880",
    bg: "#CDD3E8",
    action: (topics, title) =>
      downloadFile(`${title}.json`, JSON.stringify({ project: title, topics: topics }, null, 2), "application/json"),
  },
  {
    label: "CSV",
    description: "Open in spreadsheets",
    Icon: Sheet,
    color: "#C8952A",
    bg: "#F5E2B0",
    action: exportCSV,
  },
];

export function ExportMenu({
  topics = [],
  projectTitle,
  tagline,
  links,
}: {
  topics?: Topic[];
  projectTitle?: string;
  tagline?: string;
  links?: ProjectLink[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouse = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleMouse);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouse);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        title="Export"
        aria-label="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          background: open ? "var(--paper-3)" : "transparent",
          border: "none",
          borderRadius: 7,
          color: open ? "var(--ink)" : "var(--ink-3)",
          cursor: "pointer",
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = "var(--paper-3)";
            (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
          }
        }}
      >
        <Download size={15} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: "calc(100% + 7px)",
            right: 0,
            zIndex: 100,
            background: "var(--paper)",
            border: "1px solid var(--line-strong)",
            borderRadius: 13,
            boxShadow: "0 12px 32px rgba(29,26,22,0.14), 0 2px 8px rgba(29,26,22,0.08)",
            padding: 6,
            minWidth: 228,
          }}
        >
          <button
            onClick={() => {
              const md = buildMarkdown(projectTitle ?? "export", topics, { tagline, links });
              navigator.clipboard.writeText(md).then(() => {
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                  setOpen(false);
                }, 1400);
              });
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: copied ? "var(--forest-soft)" : "var(--paper-2)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s",
              marginBottom: 4,
            }}
            onMouseEnter={(e) => {
              if (!copied) (e.currentTarget as HTMLElement).style.background = "var(--paper-3)";
            }}
            onMouseLeave={(e) => {
              if (!copied) (e.currentTarget as HTMLElement).style.background = "var(--paper-2)";
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: "var(--forest)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#fff",
                transition: "background 0.2s",
              }}
            >
              {copied ? <Check size={14} strokeWidth={2.5} /> : <Clipboard size={14} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
                {copied ? "Copied!" : "Copy as Markdown"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 1 }}>Ready to paste anywhere</div>
            </div>
          </button>

          <div style={{ height: 1, background: "var(--line)", margin: "2px 4px 6px" }} />

          <div
            style={{
              padding: "2px 10px 5px",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--ink-4)",
            }}
          >
            Download as
          </div>

          {EXPORT_OPTIONS.map(({ label, description, Icon, color, bg, action }) => (
            <button
              key={label}
              onClick={() => {
                action(topics, projectTitle ?? "export", { tagline, links });
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "7px 10px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = bg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color,
                }}
              >
                <Icon size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>{description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
