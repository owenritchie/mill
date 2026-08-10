"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, ChevronDown, X, ArrowUp, ArrowDown, ArrowUpDown, Check,
  Columns3, Link2, CalendarRange, ExternalLink, Pencil, Layers,
  Flag, Plus, Folder, Database, ChevronRight, ArrowLeft, FilePlus, ListPlus,
} from "lucide-react";
import { PriorityPicker } from "@/components/primitives/PriorityPicker";
import { TagInput } from "@/components/primitives/TagInput";
import { HashTag } from "@/components/primitives/Tag";
import { Topic, Decision, Priority, PRIORITY_META, TONE_META, MONTHS_SHORT, TOPIC_LIMITS } from "@/lib/types";

const PRIORITY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };

type Scope = "project" | "workspace" | "all";

export interface TopicScope {
  projectId: string;
  spaceId: string;
  projectName: string;
  color: string;
  spaceName: string;
}
export interface ScopedTopic {
  topic: Topic;
  scope: TopicScope;
}

function fmtDate(s?: string): string | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

function hrefFor(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function labelFor(url: string): string {
  try {
    const u = new URL(hrefFor(url));
    const path = u.pathname.replace(/\/$/, "");
    return (u.hostname.replace(/^www\./, "") + path).slice(0, 28);
  } catch {
    return url.slice(0, 28);
  }
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function EditableCell({
  value,
  onChange,
  placeholder,
  multiline,
  size = 12.5,
  weight = 400,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  size?: number;
  weight?: number;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      if (multiline) autoGrow(el);
    });
  };
  const commit = () => { if (draft.trim() !== value) onChange(draft.trim()); setEditing(false); };
  const discard = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <div
        onClick={start}
        style={{
          cursor: "text",
          padding: "2px 4px",
          margin: "-2px -4px",
          borderRadius: 4,
          minHeight: 18,
          transition: "background 0.1s",
          fontWeight: weight,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span style={{ color: "var(--ink-4)", fontStyle: "italic", fontWeight: 400 }}>{placeholder ?? "—"}</span>
        )}
      </div>
    );
  }

  const sharedStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    border: "none",
    outline: "none",
    fontFamily: "var(--sans)",
    fontSize: size,
    fontWeight: weight,
    color: "var(--ink)",
    background: "transparent",
    padding: "2px 4px",
    margin: "-2px -4px",
    caretColor: "var(--tone, var(--forest))",
  };

  if (multiline) {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        value={draft}
        rows={1}
        autoFocus
        maxLength={maxLength}
        onChange={(e) => { setDraft(e.target.value); autoGrow(e.currentTarget); }}
        onBlur={commit}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); discard(); } }}
        onClick={(e) => e.stopPropagation()}
        style={{ ...sharedStyle, resize: "none", lineHeight: 1.5, overflow: "hidden" }}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      value={draft}
      autoFocus
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { e.preventDefault(); discard(); }
      }}
      onClick={(e) => e.stopPropagation()}
      style={{ ...sharedStyle, lineHeight: 1.4 }}
    />
  );
}

function TopicCell({ topic, onChange }: { topic: Topic; onChange: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.title);
  const ref = useRef<HTMLInputElement>(null);
  const toneSoft = TONE_META[topic.tone].soft;
  const toneDeep = TONE_META[topic.tone].deep;

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(topic.title);
    setEditing(true);
    requestAnimationFrame(() => ref.current?.select());
  };
  const commit = () => { const v = draft.trim(); if (v && v !== topic.title) onChange(v); setEditing(false); };
  const discard = () => { setDraft(topic.title); setEditing(false); };

  const pillBase: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 5,
    background: toneSoft,
    color: toneDeep,
    lineHeight: 1.45,
    maxWidth: "100%",
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        size={Math.max(4, draft.length + 1)}
        maxLength={TOPIC_LIMITS.title}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); discard(); }
        }}
        style={{
          ...pillBase,
          display: "inline-block",
          width: "auto",
          maxWidth: "100%",
          border: "none",
          outline: "none",
          fontFamily: "var(--sans)",
          caretColor: toneDeep,
        }}
      />
    );
  }

  return (
    <span
      onClick={start}
      title="Click to rename topic"
      style={{
        ...pillBase,
        display: "inline-block",
        cursor: "text",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}
    >
      {topic.title}
    </span>
  );
}

function TagsCell({
  topic,
  allTags,
  onChange,
  onCreateTag,
}: {
  topic: Topic;
  allTags: string[];
  onChange: (tags: string[]) => void;
  onCreateTag: (tag: string) => void;
}) {
  const tags = topic.tags ?? [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {tags.map((tag) => (
        <HashTag
          key={tag}
          label={tag}
          onRemove={() => onChange(tags.filter((t) => t !== tag))}
        />
      ))}
      <TagInput tags={tags} allTags={allTags} onChange={onChange} onCreateTag={onCreateTag} />
    </div>
  );
}

function DateRangeCell({
  start,
  end,
  onChange,
}: {
  start?: string;
  end?: string;
  onChange: (fields: { startDate?: string; endDate?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [editing]);

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--sans)",
    fontSize: 11.5,
    color: "var(--ink-2)",
    background: "var(--paper)",
    border: "1px solid var(--line)",
    borderRadius: 5,
    padding: "3px 5px",
    width: "100%",
  };

  if (editing) {
    return (
      <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          value={start ?? ""}
          autoFocus
          onChange={(e) => onChange({ startDate: e.target.value || undefined })}
          style={inputStyle}
        />
        <input
          type="date"
          value={end ?? ""}
          onChange={(e) => onChange({ endDate: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
    );
  }

  const s = fmtDate(start);
  const e = fmtDate(end);
  const has = s || e;

  return (
    <div
      onClick={(ev) => { ev.stopPropagation(); setEditing(true); }}
      style={{
        cursor: "pointer",
        padding: "2px 4px",
        margin: "-2px -4px",
        borderRadius: 4,
        transition: "background 0.1s",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(ev) => ((ev.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.035)")}
      onMouseLeave={(ev) => ((ev.currentTarget as HTMLElement).style.background = "transparent")}
    >
      {has ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
          <span>{s ?? "—"}</span>
          <ArrowDown size={9} style={{ transform: "rotate(-90deg)", opacity: 0.4 }} />
          <span>{e ?? "—"}</span>
        </span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink-4)", fontStyle: "italic" }}>
          <CalendarRange size={11} />
          dates
        </span>
      )}
    </div>
  );
}

function IssueCell({ url, onChange }: { url?: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const ref = useRef<HTMLInputElement>(null);

  const start = () => { setDraft(url ?? ""); setEditing(true); requestAnimationFrame(() => ref.current?.focus()); };
  const commit = () => { const v = draft.trim(); if (v !== (url ?? "")) onChange(v); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        autoFocus
        placeholder="https://…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
        }}
        style={{
          width: "100%", border: "none", outline: "none", fontFamily: "var(--sans)",
          fontSize: 11.5, color: "var(--forest)", background: "transparent",
          padding: "2px 4px", margin: "-2px -4px", caretColor: "var(--tone, var(--forest))",
        }}
      />
    );
  }

  if (url) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
        <a
          href={hrefFor(url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5,
            color: "var(--forest)", textDecoration: "none", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          <Link2 size={11} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{labelFor(url)}</span>
          <ExternalLink size={9} style={{ flexShrink: 0, opacity: 0.5 }} />
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); start(); }}
          title="Edit link"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", display: "flex", padding: 1, flexShrink: 0 }}
        >
          <Pencil size={10} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); start(); }}
      style={{
        cursor: "pointer", padding: "2px 4px", margin: "-2px -4px", borderRadius: 4,
        color: "var(--ink-4)", fontStyle: "italic", fontSize: 11.5, transition: "background 0.1s",
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.035)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      <Link2 size={11} />
      link
    </div>
  );
}

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  dim?: string;
  color?: string;
}

function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  icon,
  align = "left",
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";

  useEffect(() => {
    if (!open) return;
    const handleMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleMouse);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouse);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          background: active ? "var(--paper-3)" : "var(--paper)",
          border: `1px solid ${active ? "var(--line-strong)" : "var(--line)"}`,
          borderRadius: 8,
          padding: "0 9px 0 11px",
          fontSize: 12.5,
          color: active ? "var(--ink)" : "var(--ink-3)",
          fontFamily: "var(--sans)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          transition: "border-color 0.12s, background 0.12s, color 0.12s",
          whiteSpace: "nowrap",
          userSelect: "none",
          lineHeight: 1,
        }}
      >
        {icon && (
          <span style={{ display: "flex", alignItems: "center", opacity: 0.55 }}>
            {icon}
          </span>
        )}
        {selected?.icon && (
          <span style={{ display: "flex", alignItems: "center" }}>{selected.icon}</span>
        )}
        <span style={selected?.color ? { color: selected.color, fontWeight: 500 } : undefined}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={11}
          style={{
            opacity: 0.45,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            marginLeft: 2,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            zIndex: 300,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 11,
            boxShadow: "0 12px 32px rgba(20,29,21,0.12), 0 2px 8px rgba(20,29,21,0.06)",
            minWidth: 212,
            maxHeight: 320,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 11px",
                  borderRadius: 8,
                  fontSize: 13,
                  color: isSelected ? "var(--ink)" : "var(--ink-2)",
                  fontFamily: "var(--sans)",
                  cursor: "pointer",
                  fontWeight: isSelected ? 500 : 400,
                  background: isSelected ? "var(--paper-2)" : "transparent",
                  transition: "background 0.08s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--paper-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {opt.icon && (
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {opt.icon}
                  </span>
                )}
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: opt.color, fontWeight: opt.color ? 500 : undefined }}>{opt.label}</span>
                {opt.dim && (
                  <span style={{ fontSize: 11.5, color: "var(--ink-4)", flexShrink: 0 }}>{opt.dim}</span>
                )}
                {isSelected && (
                  <Check size={13} style={{ color: "var(--forest)", flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScopeToggle({
  value,
  onChange,
}: {
  value: Scope;
  onChange: (v: Scope) => void;
}) {
  const segments: { key: Scope; label: string; icon: React.ReactNode }[] = [
    { key: "project", label: "Project", icon: <Layers size={12} /> },
    { key: "workspace", label: "Workspace", icon: <Folder size={12} /> },
    { key: "all", label: "All workspaces", icon: <Database size={12} /> },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: 9,
        padding: 2,
        gap: 2,
        height: 30,
      }}
    >
      {segments.map(({ key, label, icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "0 11px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "var(--sans)",
              lineHeight: 1,
              whiteSpace: "nowrap",
              background: active ? "var(--paper)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-3)",
              fontWeight: active ? 500 : 400,
              boxShadow: active ? "0 1px 2px rgba(20,29,21,0.1)" : "none",
              transition: "color 0.12s, background 0.12s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", opacity: active ? 0.85 : 0.55 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

const menuMetaStyle: React.CSSProperties = {
  flexShrink: 0, maxWidth: 96, fontFamily: "var(--mono)", fontSize: 10.5,
  color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

function AddMenu({
  pickerTopics,
  scoped,
  activeProjectName,
  onAddTopic,
  onAddDecision,
}: {
  pickerTopics: { topic: Topic; scope: TopicScope | null }[];
  scoped: boolean;
  activeProjectName?: string;
  onAddTopic: () => void;
  onAddDecision: (topicId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"root" | "decision">("root");
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const close = () => { setOpen(false); setMode("root"); setQuery(""); };

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const topicMatches = q
    ? pickerTopics.filter(({ topic, scope }) =>
        topic.title.toLowerCase().includes(q) || (scope?.projectName ?? "").toLowerCase().includes(q))
    : pickerTopics;

  const createRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 11, width: "100%",
    padding: "8px 10px", borderRadius: 8, background: "transparent", border: "none",
    cursor: "pointer", textAlign: "left", fontFamily: "var(--sans)",
    transition: "background 0.1s",
  };

  const pickRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, width: "100%",
    padding: "7px 10px", borderRadius: 8, background: "transparent", border: "none",
    fontSize: 13, color: "var(--ink)", fontFamily: "var(--sans)", cursor: "pointer",
    textAlign: "left", transition: "background 0.1s",
  };

  const iconStyle: React.CSSProperties = { color: "var(--ink-3)", flexShrink: 0, marginTop: 1 };
  const titleStyle: React.CSSProperties = { fontSize: 13, color: "var(--ink)", fontWeight: 500, lineHeight: 1.25 };
  const captionStyle: React.CSSProperties = {
    fontSize: 11, color: "var(--ink-3)", lineHeight: 1.25,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  const hoverOn = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.background = "var(--paper-3)";
  };
  const hoverOff = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.background = "transparent";
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        title="Add a topic or decision"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, height: 30,
          padding: "0 9px 0 9px", background: "var(--forest)",
          border: "1px solid var(--forest)", borderRadius: 8, color: "var(--paper)",
          fontSize: 12.5, fontWeight: 500, fontFamily: "var(--sans)", cursor: "pointer",
          lineHeight: 1, whiteSpace: "nowrap", transition: "filter 0.14s",
          filter: open ? "brightness(1.22)" : "none",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.filter = "brightness(1.22)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.filter = open ? "brightness(1.22)" : "none")}
      >
        <Plus size={14} />
        Add
        <ChevronDown
          size={11}
          style={{ opacity: 0.65, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300,
            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11,
            boxShadow: "0 6px 20px rgba(20,29,21,0.12)",
            padding: 5, width: 248, display: "flex", flexDirection: "column",
            animation: "addMenuIn 0.1s ease",
          }}
        >
          <style>{`@keyframes addMenuIn {
            from { opacity: 0; transform: translateY(-4px) scale(0.985) }
            to   { opacity: 1; transform: none }
          }`}</style>

          {mode === "root" ? (
            <>
              <button
                onClick={() => { onAddTopic(); close(); }}
                style={createRowStyle}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                <FilePlus size={18} style={iconStyle} />
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={titleStyle}>Topic</span>
                  <span style={captionStyle}>
                    {activeProjectName ? `In ${activeProjectName}` : "A question to work through"}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setMode("decision")}
                disabled={pickerTopics.length === 0}
                style={{ ...createRowStyle, opacity: pickerTopics.length === 0 ? 0.45 : 1, cursor: pickerTopics.length === 0 ? "not-allowed" : "pointer" }}
                onMouseEnter={(e) => { if (pickerTopics.length) hoverOn(e); }}
                onMouseLeave={hoverOff}
              >
                <ListPlus size={18} style={iconStyle} />
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                  <span style={titleStyle}>Decision</span>
                  <span style={captionStyle}>
                    {pickerTopics.length === 0 ? "No topics to add one to yet" : "A call made inside a topic"}
                  </span>
                </span>
                <ChevronRight size={14} style={{ color: "var(--ink-4)", flexShrink: 0, marginTop: 2 }} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode("root"); setQuery(""); }}
                style={{ ...pickRowStyle, color: "var(--ink-3)" }}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                <ArrowLeft size={18} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500 }}>Add decision to…</span>
              </button>

              <div
                style={{
                  display: "flex", alignItems: "center", gap: 11, height: 34,
                  padding: "0 10px", margin: "1px 0 4px",
                  borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
                }}
              >
                <Search size={18} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search topics…"
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    fontSize: 13, color: "var(--ink)", fontFamily: "var(--sans)", minWidth: 0,
                  }}
                />
              </div>

              <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {topicMatches.length === 0 ? (
                  <div style={{ padding: "10px 10px 12px", fontSize: 12.5, color: "var(--ink-3)" }}>
                    {q ? "No topics match." : "No topics here yet."}
                  </div>
                ) : (
                  topicMatches.map(({ topic, scope }) => (
                    <button
                      key={scope ? `${scope.projectId}:${topic.id}` : topic.id}
                      onClick={() => { onAddDecision(topic.id); close(); }}
                      style={{ ...pickRowStyle, flexShrink: 0 }}
                      onMouseEnter={hoverOn}
                      onMouseLeave={hoverOff}
                    >
                      <span style={{ width: 18, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: TONE_META[topic.tone].deep }} />
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {topic.title}
                      </span>
                      {scoped && scope && (
                        <span style={menuMetaStyle} title={scope.projectName}>{scope.projectName}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type ColKey = "decision" | "note" | "source" | "topic" | "summary" | "priority" | "tags" | "timeline" | "issue";

const COLUMNS: { key: ColKey; label: string; defaultWidth: number; sortable: boolean; scopeOnly?: boolean }[] = [
  { key: "decision", label: "Decision", defaultWidth: 210, sortable: true },
  { key: "note", label: "Notes", defaultWidth: 190, sortable: true },
  { key: "source", label: "Workspace", defaultWidth: 150, sortable: true, scopeOnly: true },
  { key: "topic", label: "Topic", defaultWidth: 130, sortable: true },
  { key: "summary", label: "Summary", defaultWidth: 190, sortable: true },
  { key: "priority", label: "Priority", defaultWidth: 96, sortable: true },
  { key: "tags", label: "Tags", defaultWidth: 120, sortable: false },
  { key: "timeline", label: "Timeline", defaultWidth: 118, sortable: true },
  { key: "issue", label: "Issue", defaultWidth: 110, sortable: false },
];

const MIN_COL_WIDTH = 64;

function ColumnsMenu({
  visible,
  onToggle,
  columns,
}: {
  visible: Set<ColKey>;
  onToggle: (key: ColKey) => void;
  columns: typeof COLUMNS;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 30,
          background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8,
          padding: "0 10px", fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--sans)",
          cursor: "pointer", lineHeight: 1, whiteSpace: "nowrap",
        }}
      >
        <Columns3 size={13} style={{ opacity: 0.6 }} />
        Columns
        <ChevronDown size={11} style={{ opacity: 0.45, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 300,
            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11,
            boxShadow: "0 12px 32px rgba(20,29,21,0.12), 0 2px 8px rgba(20,29,21,0.06)",
            padding: 6, minWidth: 178,
          }}
        >
          <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)", padding: "4px 11px 7px" }}>
            Visible columns
          </div>
          {columns.map((c) => {
            const on = visible.has(c.key);
            const locked = c.key === "decision";
            return (
              <div
                key={c.key}
                onClick={() => !locked && onToggle(c.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "7px 11px",
                  borderRadius: 8, fontSize: 13, fontFamily: "var(--sans)",
                  color: locked ? "var(--ink-4)" : "var(--ink-2)",
                  cursor: locked ? "default" : "pointer",
                }}
                onMouseEnter={(e) => { if (!locked) (e.currentTarget as HTMLElement).style.background = "var(--paper-2)"; }}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                <span
                  style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${on ? "var(--forest)" : "var(--line-strong)"}`,
                    background: on ? "var(--forest)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {on && <Check size={11} style={{ color: "var(--paper)" }} />}
                </span>
                {c.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SortCol = "" | "decision" | "note" | "source" | "topic" | "summary" | "priority" | "timeline";
type SortDir = "asc" | "desc";

function ResizeHandle({ onStart }: { onStart: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseDown={onStart}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        top: 4,
        bottom: 4,
        right: -4,
        width: 9,
        cursor: "col-resize",
        display: "flex",
        justifyContent: "center",
        zIndex: 3,
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: 2,
          height: "100%",
          borderRadius: 2,
          background: hover ? "var(--forest)" : "transparent",
          transition: "background 0.1s",
        }}
      />
    </div>
  );
}

const HEADER_BASE: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "10px 12px 9px",
  borderBottom: "1px solid var(--line-strong)",
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "var(--paper-2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
};

function SortableHeader({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  onResizeStart,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        ...HEADER_BASE,
        color: active ? "var(--ink)" : "var(--ink-3)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        userSelect: "none",
        transition: "color 0.12s",
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {active ? (
          sortDir === "asc"
            ? <ArrowUp size={9} style={{ opacity: 0.7, flexShrink: 0 }} />
            : <ArrowDown size={9} style={{ opacity: 0.7, flexShrink: 0 }} />
        ) : (
          <ArrowUpDown size={9} style={{ opacity: 0.25, flexShrink: 0 }} />
        )}
      </div>
      <ResizeHandle onStart={onResizeStart} />
    </th>
  );
}

function StaticHeader({ label, onResizeStart }: { label: string; onResizeStart: (e: React.MouseEvent) => void }) {
  return (
    <th style={{ ...HEADER_BASE, color: "var(--ink-3)" }}>
      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <ResizeHandle onStart={onResizeStart} />
    </th>
  );
}

interface Props {
  topics: Topic[];
  allTopics?: ScopedTopic[];
  activeSpaceId?: string | null;
  activeProjectName?: string;
  allTags?: string[];
  onCreateTag?: (tag: string) => void;
  onEditTopic: (id: string, fields: Partial<Topic>) => void;
  onEditDecision: (topicId: string, decisionId: string, fields: Partial<Decision>) => void;
  onAddTopic?: () => void;
  onAddDecision?: (topicId: string) => void;
}

export function TableView({
  topics,
  allTopics,
  activeSpaceId,
  activeProjectName,
  allTags = [],
  onCreateTag,
  onEditTopic,
  onEditDecision,
  onAddTopic,
  onAddDecision,
}: Props) {
  const [scope, setScope] = useState<Scope>("project");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    () => new Set(COLUMNS.map((c) => c.key))
  );
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColKey, number>
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const resizing = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);

  const startResize = (key: ColKey) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { key, startX: e.clientX, startW: colWidths[key] };
    const move = (ev: MouseEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(MIN_COL_WIDTH, r.startW + (ev.clientX - r.startX));
      setColWidths((prev) => ({ ...prev, [r.key]: w }));
    };
    const up = () => {
      resizing.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const scopedMode = scope !== "project" && !!allTopics;

  const changeScope = (next: Scope) => {
    setScope(next);
    setTopicFilter("");
    setTagFilter("");
  };

  const toggleCol = (key: ColKey) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rowSource: ScopedTopic[] = useMemo(() => {
    if (!allTopics || scope === "project") {
      return topics.map((topic) => ({ topic, scope: null as unknown as TopicScope }));
    }
    if (scope === "workspace") {
      return allTopics.filter((r) => r.scope.spaceId === activeSpaceId);
    }
    return allTopics;
  }, [scope, allTopics, topics, activeSpaceId]);
  const datasetTopics = useMemo(() => rowSource.map((r) => r.topic), [rowSource]);

  const allTagsList = useMemo(
    () => [...new Set(datasetTopics.flatMap((i) => i.tags ?? []))].sort(),
    [datasetTopics]
  );

  const facetCounts = useMemo(() => {
    const byTopic: Record<string, number> = {};
    const priority: Record<string, number> = {};
    const tag: Record<string, number> = {};
    let noPriority = 0;
    let total = 0;
    for (const topic of datasetTopics) {
      const n = topic.decisions.length;
      total += n;
      byTopic[topic.id] = n;
      if (topic.priority) priority[topic.priority] = (priority[topic.priority] ?? 0) + n;
      else noPriority += n;
      for (const t of topic.tags ?? []) tag[t] = (tag[t] ?? 0) + n;
    }
    return { topic: byTopic, priority, tag, noPriority, total };
  }, [datasetTopics]);

  const topicOptions: DropdownOption[] = [
    { value: "", label: "All topics", dim: String(facetCounts.total) },
    ...datasetTopics.map((i) => ({
      value: i.id,
      label: i.title,
      dim: String(facetCounts.topic[i.id] ?? 0),
      icon: (
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: 4,
            background: TONE_META[i.tone].deep,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      ),
    })),
  ];

  const priorityOptions: DropdownOption[] = [
    { value: "", label: "All priorities", dim: String(facetCounts.total) },
    ...(Object.entries(PRIORITY_META) as [Priority, typeof PRIORITY_META[Priority]][]).map(([k, p]) => ({
      value: k,
      label: p.label,
      dim: String(facetCounts.priority[k] ?? 0),
      icon: <Flag size={11} style={{ color: p.color, fill: p.color, flexShrink: 0 }} />,
    })),
    {
      value: "none",
      label: "No priority",
      dim: String(facetCounts.noPriority),
      icon: <Flag size={11} style={{ color: "var(--ink-4)", fill: "none", flexShrink: 0 }} />,
    },
  ];

  const tagOptions: DropdownOption[] = [
    { value: "", label: "All tags", dim: String(facetCounts.total) },
    ...allTagsList.map((t) => ({ value: t, label: `#${t}`, dim: String(facetCounts.tag[t] ?? 0), color: "var(--sage)" })),
  ];

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(""); setSortDir("asc"); }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const allRows = rowSource.flatMap(({ topic, scope: sc }) =>
    topic.decisions.map((d) => ({ decision: d as Decision | null, topic, scope: sc }))
  );

  let filtered = allRows.filter(({ decision, topic, scope: sc }) => {
    if (topicFilter && topic.id !== topicFilter) return false;
    if (priorityFilter === "none" && topic.priority) return false;
    if (priorityFilter && priorityFilter !== "none" && topic.priority !== priorityFilter) return false;
    if (tagFilter && !(topic.tags ?? []).includes(tagFilter)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (
        !decision?.title?.toLowerCase().includes(q) &&
        !topic.title?.toLowerCase().includes(q) &&
        !topic.summary?.toLowerCase().includes(q) &&
        !decision?.note?.toLowerCase().includes(q) &&
        !(topic.issueUrl ?? "").toLowerCase().includes(q) &&
        !(sc?.projectName ?? "").toLowerCase().includes(q) &&
        !(sc?.spaceName ?? "").toLowerCase().includes(q) &&
        !(topic.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "decision") cmp = (a.decision?.title ?? "").localeCompare(b.decision?.title ?? "");
      if (sortCol === "topic") cmp = a.topic.title.localeCompare(b.topic.title);
      if (sortCol === "summary") cmp = (a.topic.summary ?? "").localeCompare(b.topic.summary ?? "");
      if (sortCol === "source") {
        cmp = (a.scope?.spaceName ?? "").localeCompare(b.scope?.spaceName ?? "");
        if (cmp === 0) cmp = (a.scope?.projectName ?? "").localeCompare(b.scope?.projectName ?? "");
      }
      if (sortCol === "priority") {
        cmp = (PRIORITY_ORDER[a.topic.priority ?? ""] ?? 99) - (PRIORITY_ORDER[b.topic.priority ?? ""] ?? 99);
      }
      if (sortCol === "timeline") {
        const da = a.topic.startDate ?? "";
        const db = b.topic.startDate ?? "";
        if (!da && !db) cmp = 0;
        else if (!da) cmp = 1;
        else if (!db) cmp = -1;
        else cmp = da.localeCompare(db);
      }
      if (sortCol === "note") {
        const hasA = a.decision?.note ? 1 : 0;
        const hasB = b.decision?.note ? 1 : 0;
        cmp = hasB - hasA;
        if (cmp === 0) cmp = (a.decision?.note ?? "").localeCompare(b.decision?.note ?? "");
      }
      return sortDir === "desc" && sortCol !== "note" ? -cmp : cmp;
    });
  }

  const isFiltered = topicFilter || priorityFilter || tagFilter || query.trim();
  const columns = COLUMNS.filter((c) => !c.scopeOnly || scopedMode);
  const shownCols = columns.filter((c) => visibleCols.has(c.key));
  const totalWidth = shownCols.reduce((sum, c) => sum + colWidths[c.key], 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--paper-2)" }}>
      <div
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 20px 9px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "6px 12px",
            }}
          >
            <Search size={14} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                scope === "all" ? "Search every workspace…"
                : scope === "workspace" ? "Search this workspace…"
                : "Search decisions, topics, summaries, tags, notes…"
              }
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: "var(--ink)",
                fontFamily: "var(--sans)",
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                style={{ color: "var(--ink-4)", lineHeight: 1, padding: "0 2px", background: "none", border: "none", cursor: "pointer", display: "flex" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--mono)", flexShrink: 0 }}>
            {filtered.length}
            <span style={{ opacity: 0.5 }}> / </span>
            {allRows.length}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 20px 9px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {allTopics && <ScopeToggle value={scope} onChange={changeScope} />}
            <Dropdown
              value={topicFilter}
              onChange={setTopicFilter}
              options={topicOptions}
              placeholder="All topics"
            />
            <Dropdown
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityOptions}
              placeholder="All priorities"
            />
            <Dropdown
              value={tagFilter}
              onChange={setTagFilter}
              options={tagOptions}
              placeholder="All tags"
              disabled={allTagsList.length === 0}
            />
            {onAddTopic && onAddDecision && (
              <AddMenu
                pickerTopics={rowSource}
                scoped={scopedMode}
                activeProjectName={activeProjectName}
                onAddTopic={onAddTopic}
                onAddDecision={onAddDecision}
              />
            )}
            {isFiltered && (
              <button
                onClick={() => { setTopicFilter(""); setPriorityFilter(""); setTagFilter(""); setQuery(""); }}
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  fontFamily: "var(--sans)",
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sortCol && (
              <button
                onClick={() => { setSortCol(""); setSortDir("asc"); }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "var(--ink-3)",
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                }}
              >
                <X size={11} />
                Sort
              </button>
            )}
            <ColumnsMenu visible={visibleCols} onToggle={toggleCol} columns={columns} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingRight: 20 }}>
        <table style={{ width: totalWidth, minWidth: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
          <colgroup>
            {shownCols.map((c) => (
              <col key={c.key} style={{ width: colWidths[c.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {shownCols.map((c) =>
                c.sortable ? (
                  <SortableHeader
                    key={c.key}
                    col={c.key as SortCol}
                    label={c.label}
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    onResizeStart={startResize(c.key)}
                  />
                ) : (
                  <StaticHeader key={c.key} label={c.label} onResizeStart={startResize(c.key)} />
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={shownCols.length} style={{ padding: "48px 24px", color: "var(--ink-4)", textAlign: "center", fontStyle: "italic" }}>
                  No decisions match your filters.
                </td>
              </tr>
            ) : (
              filtered.map(({ decision, topic, scope: sc }) => {
                const cellBase: React.CSSProperties = { padding: "7px 12px", verticalAlign: "top", overflowWrap: "break-word" };
                return (
                  <tr
                    key={`${topic.id}:${decision?.id ?? "none"}`}
                    className={`tone-${topic.tone}`}
                    style={{ borderBottom: "1px solid var(--line)", transition: "background 0.1s" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--paper)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    {visibleCols.has("decision") && (
                      <td style={{ ...cellBase, fontSize: 12.5, fontWeight: 500 }}>
                        {decision ? (
                          <EditableCell
                            value={decision.title}
                            onChange={(v) => onEditDecision(topic.id, decision.id, { title: v })}
                            placeholder="Untitled decision"
                            weight={500}
                            multiline
                          />
                        ) : (
                          <span style={{ color: "var(--ink-4)", fontStyle: "italic", fontWeight: 400 }}>No decisions yet</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("note") && (
                      <td style={{ ...cellBase, fontSize: 12, color: "var(--ink-3)" }}>
                        {decision ? (
                          <EditableCell
                            value={decision.note ?? ""}
                            onChange={(v) => onEditDecision(topic.id, decision.id, { note: v })}
                            placeholder="Add notes…"
                            multiline
                            size={12}
                          />
                        ) : (
                          <span style={{ color: "var(--ink-4)" }}>—</span>
                        )}
                      </td>
                    )}
                    {scopedMode && visibleCols.has("source") && (
                      <td style={cellBase}>
                        {sc ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.projectName}</span>
                            </span>
                            <span style={{ fontSize: 11, color: "var(--ink-4)", paddingLeft: 13 }}>
                              {sc.spaceName}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--ink-4)" }}>—</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("topic") && (
                      <td style={cellBase}>
                        <TopicCell topic={topic} onChange={(title) => onEditTopic(topic.id, { title })} />
                      </td>
                    )}
                    {visibleCols.has("summary") && (
                      <td style={{ ...cellBase, fontSize: 12, color: "var(--ink-3)" }}>
                        <EditableCell
                          value={topic.summary ?? ""}
                          onChange={(v) => onEditTopic(topic.id, { summary: v })}
                          placeholder="Add summary…"
                          multiline
                          size={12}
                          maxLength={TOPIC_LIMITS.summary}
                        />
                      </td>
                    )}
                    {visibleCols.has("priority") && (
                      <td style={cellBase}>
                        <PriorityPicker
                          priority={topic.priority ?? null}
                          onChange={(p) => onEditTopic(topic.id, { priority: p ?? undefined })}
                        />
                      </td>
                    )}
                    {visibleCols.has("tags") && (
                      <td style={cellBase}>
                        <TagsCell
                          topic={topic}
                          allTags={allTags}
                          onChange={(tags) => onEditTopic(topic.id, { tags })}
                          onCreateTag={onCreateTag ?? (() => {})}
                        />
                      </td>
                    )}
                    {visibleCols.has("timeline") && (
                      <td style={{ ...cellBase, fontSize: 11.5 }}>
                        <DateRangeCell
                          start={topic.startDate}
                          end={topic.endDate}
                          onChange={(fields) => onEditTopic(topic.id, fields)}
                        />
                      </td>
                    )}
                    {visibleCols.has("issue") && (
                      <td style={cellBase}>
                        <IssueCell
                          url={topic.issueUrl}
                          onChange={(v) => onEditTopic(topic.id, { issueUrl: v || undefined })}
                        />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
