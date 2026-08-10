"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import {
  X, Link, Plus, Trash2, ChevronRight, ChevronDown, Check,
  SquareArrowOutUpRight, CornerDownLeft,
} from "lucide-react";
import { PriorityPicker } from "@/components/primitives/PriorityPicker";
import { TagInput } from "@/components/primitives/TagInput";
import { HashTag } from "@/components/primitives/Tag";
import { EnhanceButton } from "@/components/ui/EnhanceButton";
import { WandButton } from "@/components/ui/WandButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { Topic, Decision, Tone, Priority, TONES, TONE_META, TOPIC_LIMITS } from "@/lib/types";
import { enhanceDecision, enhanceTopic, enhanceTopicDraft, enhanceDecisionDraft } from "@/app/actions/ai";

interface LocalDecision {
  id: string;
  title: string;
  note: string;
}

export interface TopicCreationFields {
  title: string;
  summary: string;
  tone: Tone;
  priority: Priority | null;
  tags: string[];
  issueUrl?: string;
  startDate?: string;
  endDate?: string;
  decisions: LocalDecision[];
}

type TopicPanelProps =
  | {
      mode: "create";
      allTags: string[];
      onCommit: (fields: TopicCreationFields) => void;
      onCancel: () => void;
      onCreateTag: (tag: string) => void;
    }
  | {
      mode: "edit";
      topic: Topic;
      allTags: string[];
      onEditTopic: (fields: Partial<Topic>) => void;
      onEditDecision: (id: string, fields: Partial<Decision>) => void;
      onDeleteDecision: (id: string) => void;
      onAddDecision: (title: string) => void;
      onTopicReplaced: (topic: Topic) => void;
      onClose: () => void;
      onDeleteTopic: () => void;
      onCreateTag: (tag: string) => void;
      autoAddDecision?: boolean;
    };

function DecisionNote({
  value,
  onChange,
  onKeyDown,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="ip-dec-note"
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

function addMonthsClamped(y: number, m0: number, d: number, add: number) {
  const total = m0 + add;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return new Date(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

function formatSpan(startISO?: string, endISO?: string): string | null {
  if (!startISO || !endISO) return null;
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (end < start) return null;
  if (end.getTime() === start.getTime()) return "Same day";

  let months = 0;
  while (addMonthsClamped(sy, sm - 1, sd, months + 1) <= end) months++;
  const years = Math.floor(months / 12);
  const mo = months % 12;
  const anchor = addMonthsClamped(sy, sm - 1, sd, months);
  const days = Math.round((end.getTime() - anchor.getTime()) / 86_400_000);

  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (mo) parts.push(`${mo} ${mo === 1 ? "month" : "months"}`);
  if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  return parts.length ? parts.join(" ") : "Same day";
}

export function TopicPanel(props: TopicPanelProps) {
  const isCreate = props.mode === "create";
  const seed = props.mode === "edit" ? props.topic : null;

  const [title, setTitle]       = useState(seed?.title ?? "");
  const [summary, setSummary]   = useState(seed?.summary ?? "");
  const [tone, setTone]         = useState<Tone>(seed?.tone ?? "ink");
  const [priority, setPriority] = useState<Priority | null>(seed?.priority ?? null);
  const [tags, setTags]         = useState<string[]>(seed?.tags ?? []);
  const [issueUrl, setIssueUrl] = useState(seed?.issueUrl ?? "");
  const [startDate, setStartDate] = useState(seed?.startDate ?? "");
  const [endDate, setEndDate]   = useState(seed?.endDate ?? "");

  const [localDecisions, setLocalDecisions] = useState<LocalDecision[]>(() =>
    isCreate
      ? [{ id: crypto.randomUUID(), title: "", note: "" }]
      : (seed?.decisions.map((d) => ({ id: d.id, title: d.title, note: d.note })) ?? [])
  );

  const [addingDecision, setAddingDecision] = useState(
    () => props.mode === "edit" && !!props.autoAddDecision
  );
  const [newDecTitle, setNewDecTitle]       = useState("");
  const [toneOpen, setToneOpen]             = useState(false);
  const [expandedDecs, setExpandedDecs]     = useState<Set<string>>(
    () => new Set(seed?.decisions.filter((d) => d.note).map((d) => d.id))
  );
  const [enhancingId, setEnhancingId]       = useState<string | null>(null);
  const [, startEnhance]                    = useTransition();
  const [enhancingTopic, setEnhancingTopic]   = useState(false);
  const [enhanceError, setEnhanceError]     = useState<string | null>(null);
  const [, startEnhanceTopic]                = useTransition();

  const expandIfNoted = (decisionId: string, note: string) =>
    setExpandedDecs((prev) => {
      if (prev.has(decisionId) || !note.trim()) return prev;
      const next = new Set(prev);
      next.add(decisionId);
      return next;
    });

  const runEnhance = (decisionId: string) => {
    if (enhancingId) return;

    if (isCreate) {
      const target = localDecisions.find((d) => d.id === decisionId);
      if (!target) return;
      setEnhancingId(decisionId);
      startEnhance(async () => {
        const res = await enhanceDecisionDraft({
          topic: { title: title.trim(), summary: summary.trim(), tone, priority, tags },
          decisions: localDecisions.map((d) => ({ id: d.id, title: d.title, note: d.note })),
          targetId: decisionId,
        });
        if (res.ok) {
          setLocalDecisions((prev) =>
            prev.map((d) => (d.id === decisionId ? { ...d, title: res.title, note: res.note } : d)),
          );
          expandIfNoted(decisionId, res.note);
        } else {
          setEnhanceError(res.error);
        }
        setEnhancingId(null);
      });
      return;
    }

    setEnhancingId(decisionId);
    startEnhance(async () => {
      const res = await enhanceDecision(decisionId);
      if (res.ok && props.mode === "edit") {
        props.onEditDecision(decisionId, { title: res.title, note: res.note });
        expandIfNoted(decisionId, res.note);
      }
      setEnhancingId(null);
    });
  };

  const runEnhanceTopic = () => {
    if (enhancingTopic) return;

    if (isCreate) {
      const hasContent =
        title.trim() !== "" || summary.trim() !== "" || localDecisions.some((d) => d.title.trim());
      if (!hasContent) return;
      setEnhancingTopic(true);
      setEnhanceError(null);
      startEnhanceTopic(async () => {
        const res = await enhanceTopicDraft({
          title: title.trim(),
          summary: summary.trim(),
          tone,
          priority,
          tags,
          decisions: localDecisions.map((d) => ({ id: d.id, title: d.title, note: d.note })),
        });
        if (res.ok) {
          setTitle(res.draft.title);
          setSummary(res.draft.summary);
          setTone(res.draft.tone);
          setPriority(res.draft.priority);
          setTags(res.draft.tags);
          const nextDecs = res.draft.decisions.map((d) => ({
            id: d.id ?? crypto.randomUUID(),
            title: d.title,
            note: d.note,
          }));
          setLocalDecisions(
            nextDecs.length ? nextDecs : [{ id: crypto.randomUUID(), title: "", note: "" }],
          );
          setExpandedDecs(new Set(nextDecs.filter((d) => d.note.trim()).map((d) => d.id)));
        } else {
          setEnhanceError(res.error);
        }
        setEnhancingTopic(false);
      });
      return;
    }

    if (props.mode !== "edit") return;
    setEnhancingTopic(true);
    setEnhanceError(null);
    const topicId = props.topic.id;
    startEnhanceTopic(async () => {
      const res = await enhanceTopic(topicId);
      if (res.ok && props.mode === "edit") {
        setTitle(res.topic.title);
        setSummary(res.topic.summary);
        setTone(res.topic.tone);
        setPriority(res.topic.priority);
        setTags(res.topic.tags);
        props.onTopicReplaced(res.topic);
        setExpandedDecs((prev) => {
          const next = new Set(prev);
          for (const d of res.topic.decisions) if (d.note.trim()) next.add(d.id);
          return next;
        });
      } else if (!res.ok) {
        setEnhanceError(res.error);
      }
      setEnhancingTopic(false);
    });
  };

  const titleRef   = useRef<HTMLInputElement>(null);
  const tonePopRef = useRef<HTMLDivElement>(null);
  const newDecRef  = useRef<HTMLInputElement>(null);
  const decRefs    = useRef<Record<string, HTMLInputElement | null>>({});

  const canCommit = title.trim().length > 0;
  const onClose   = isCreate ? props.onCancel : props.onClose;

  useEffect(() => { if (isCreate) titleRef.current?.focus(); }, [isCreate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    if (!toneOpen) return;
    const h = (e: MouseEvent) => {
      if (!tonePopRef.current?.contains(e.target as Node)) setToneOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [toneOpen]);

  useEffect(() => {
    if (addingDecision) setTimeout(() => newDecRef.current?.focus(), 0);
  }, [addingDecision]);

  const handleCommit = useCallback(() => {
    if (!canCommit || !isCreate) return;
    props.onCommit({
      title: title.trim(),
      summary: summary.trim(),
      tone,
      priority,
      tags,
      issueUrl: issueUrl.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      decisions: localDecisions.filter((d) => d.title.trim()),
    });
  }, [canCommit, isCreate, props, title, summary, tone, priority, tags, issueUrl, startDate, endDate, localDecisions]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommit();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleCommit]);

  const handleTitle    = (v: string) => { setTitle(v);    if (!isCreate) props.onEditTopic({ title: v }); };
  const handleSummary  = (v: string) => { setSummary(v);  if (!isCreate) props.onEditTopic({ summary: v }); };
  const handlePriority = (p: Priority | null) => { setPriority(p); if (!isCreate) props.onEditTopic({ priority: p ?? undefined }); };
  const handleTags     = (t: string[]) => { setTags(t);   if (!isCreate) props.onEditTopic({ tags: t }); };
  const handleIssue    = (v: string) => { setIssueUrl(v); if (!isCreate) props.onEditTopic({ issueUrl: v || undefined }); };
  const handleStart    = (v: string) => { setStartDate(v); if (!isCreate) props.onEditTopic({ startDate: v || undefined }); };
  const handleEnd      = (v: string) => { setEndDate(v);  if (!isCreate) props.onEditTopic({ endDate: v || undefined }); };

  const handleTone = (t: Tone) => {
    setTone(t);
    setToneOpen(false);
    if (!isCreate) props.onEditTopic({ tone: t });
  };

  const toggleExpanded = (id: string) =>
    setExpandedDecs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const updateLocalDec = (id: string, field: "title" | "note", value: string) =>
    setLocalDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));

  const removeLocalDec = (id: string) =>
    setLocalDecisions((prev) => {
      if (prev.length === 1) return [{ id: crypto.randomUUID(), title: "", note: "" }];
      return prev.filter((d) => d.id !== id);
    });

  const addLocalDecAfter = (afterId: string) => {
    const newId = crypto.randomUUID();
    setLocalDecisions((prev) => {
      const idx = prev.findIndex((d) => d.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, { id: newId, title: "", note: "" });
      return next;
    });
    setTimeout(() => decRefs.current[newId]?.focus(), 0);
  };

  const submitNewDecision = () => {
    const t = newDecTitle.trim();
    if (t && !isCreate) props.onAddDecision(t);
    setNewDecTitle("");
    setAddingDecision(false);
  };

  const decisions: LocalDecision[] = isCreate
    ? localDecisions
    : (props.mode === "edit" ? props.topic.decisions.map((d) => ({ id: d.id, title: d.title, note: d.note })) : []);

  const toneMeta = TONE_META[tone];
  const span = formatSpan(startDate, endDate);
  const canEnhance = !isCreate
    || title.trim() !== "" || summary.trim() !== "" || decisions.some((d) => d.title.trim());

  return (
    <div className="ip-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ip-panel tone-${tone}`} onClick={(e) => e.stopPropagation()}>

        <button className="ip-close" onClick={onClose} title="Close (Esc)" aria-label="Close">
          <X size={15} />
        </button>

        <div className="ip-body">

          <div className="ip-left">

            <input
              ref={titleRef}
              className="ip-title"
              value={title}
              maxLength={TOPIC_LIMITS.title}
              onChange={(e) => handleTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isCreate) { e.preventDefault(); handleCommit(); }
              }}
              placeholder="Name this topic…"
              aria-label="Topic title"
            />

            <div className="ip-tone-row">
              <div className="ip-tone-wrap" ref={tonePopRef}>
                <button className="ip-tone-chip" onClick={() => setToneOpen((v) => !v)}>
                  <span className="ip-tone-dot" style={{ background: toneMeta.base }} />
                  <span className="ip-tone-label">{toneMeta.label}</span>
                  <ChevronDown size={10} className="ip-tone-chevron" />
                </button>
                {toneOpen && (
                  <div className="ip-tone-pop" role="listbox" aria-label="Select tone">
                    {TONES.map((t) => {
                      const selected = tone === t;
                      return (
                        <button
                          key={t}
                          className={`ip-tone-opt${selected ? " is-active" : ""}`}
                          role="option"
                          aria-selected={selected}
                          onClick={() => handleTone(t)}
                        >
                          <span className="ip-tone-swatch" style={{ background: TONE_META[t].base }} />
                          {TONE_META[t].label}
                          {selected && <Check size={11} className="ip-tone-check" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {props.mode === "edit" && (
                <button
                  className="ip-delete"
                  onClick={props.onDeleteTopic}
                  title="Delete topic"
                  aria-label="Delete topic"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <textarea
              className="ip-summary"
              value={summary}
              maxLength={TOPIC_LIMITS.summary}
              onChange={(e) => handleSummary(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="What's the context or goal?"
              rows={2}
              aria-label="Summary"
            />

            <div className="ip-link">
              <Link size={13} className="ip-link-icon" aria-hidden />
              <input
                className="ip-link-input"
                value={issueUrl}
                onChange={(e) => handleIssue(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Paste a link…"
                aria-label="Issue or reference link"
              />
              {issueUrl && (
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ip-link-open"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open link"
                >
                  <SquareArrowOutUpRight size={12} />
                </a>
              )}
            </div>

            <p className="ip-label">Decisions</p>
            <div className="ip-decisions">
              {decisions.map((d, i) => {
                const expanded = expandedDecs.has(d.id);
                return (
                  <div key={d.id} className="ip-dec">
                    <div className="ip-dec-row">
                      <span className="ip-dec-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                      <input
                        ref={(el) => { decRefs.current[d.id] = el; }}
                        className="ip-dec-input"
                        value={d.title}
                        placeholder={i === 0 ? "What's the first call to make?" : "Another decision…"}
                        aria-label={`Decision ${i + 1}`}
                        onChange={(e) => {
                          if (isCreate) updateLocalDec(d.id, "title", e.target.value);
                          else props.onEditDecision(d.id, { title: e.target.value });
                        }}
                        onKeyDown={(e) => {
                          if (isCreate) {
                            if (e.key === "Enter") { e.preventDefault(); addLocalDecAfter(d.id); }
                            if (e.key === "Backspace" && !d.title && localDecisions.length > 1) {
                              e.preventDefault();
                              const idx = localDecisions.findIndex((x) => x.id === d.id);
                              removeLocalDec(d.id);
                              if (idx > 0) setTimeout(() => decRefs.current[localDecisions[idx - 1].id]?.focus(), 0);
                            }
                          }
                          e.stopPropagation();
                        }}
                      />
                      <div className="ip-dec-actions">
                        <WandButton
                          onClick={() => runEnhance(d.id)}
                          tabIndex={-1}
                          loading={enhancingId === d.id}
                          title="Enhance with AI"
                        />
                        <button
                          className="ip-dec-btn is-delete"
                          onClick={() => {
                            if (isCreate) removeLocalDec(d.id);
                            else props.onDeleteDecision(d.id);
                          }}
                          tabIndex={-1}
                          aria-label="Remove decision"
                        >
                          <Trash2 size={11} strokeWidth={2} />
                        </button>
                        <button
                          className={`ip-dec-btn is-expand${expanded ? " is-open" : ""}`}
                          onClick={() => toggleExpanded(d.id)}
                          tabIndex={-1}
                          aria-label={expanded ? "Collapse note" : "Add note"}
                          aria-expanded={expanded}
                        >
                          <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="ip-dec-note-wrap">
                        <DecisionNote
                          value={d.note}
                          placeholder="Add context or reasoning…"
                          onChange={(v) => {
                            if (isCreate) updateLocalDec(d.id, "note", v);
                            else props.onEditDecision(d.id, { note: v });
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {!isCreate && addingDecision && (
                <div className="ip-dec is-adding">
                  <div className="ip-dec-row">
                    <span className="ip-dec-num" aria-hidden>{String(decisions.length + 1).padStart(2, "0")}</span>
                    <input
                      ref={newDecRef}
                      className="ip-dec-input"
                      value={newDecTitle}
                      placeholder="What's the next call to make?"
                      onChange={(e) => setNewDecTitle(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") { e.preventDefault(); submitNewDecision(); }
                        if (e.key === "Escape") { setAddingDecision(false); setNewDecTitle(""); }
                      }}
                      onBlur={submitNewDecision}
                    />
                  </div>
                </div>
              )}

              {!addingDecision && (
                <div className="ip-dec-add-row">
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      if (isCreate) {
                        const newId = crypto.randomUUID();
                        setLocalDecisions((prev) => [...prev, { id: newId, title: "", note: "" }]);
                        setTimeout(() => decRefs.current[newId]?.focus(), 0);
                      } else {
                        setAddingDecision(true);
                      }
                    }}
                  >
                    <Plus size={12} />
                    Add decision
                  </button>
                  <EnhanceButton
                    onClick={runEnhanceTopic}
                    loading={enhancingTopic}
                    disabled={!canEnhance}
                  />
                </div>
              )}
              {enhanceError && (
                <div className="ip-enhance-error" role="alert">{enhanceError}</div>
              )}
            </div>
          </div>

          <div className="ip-right">

            <div className="ip-meta-section">
              <p className="ip-label">Priority</p>
              <PriorityPicker priority={priority} onChange={handlePriority} />
            </div>

            <div className="ip-meta-section">
              <p className="ip-label">Tags</p>
              <div className="ip-tags-wrap">
                {tags.map((tag) => (
                  <HashTag
                    key={tag}
                    label={tag}
                    onRemove={() => handleTags(tags.filter((x) => x !== tag))}
                  />
                ))}
                <TagInput
                  tags={tags}
                  allTags={props.allTags}
                  onChange={handleTags}
                  onCreateTag={props.onCreateTag}
                />
              </div>
            </div>

            <div className="ip-meta-section">
              <p className="ip-label">Timeline</p>
              <div className="ip-date-group">
                <DatePicker
                  label="Start"
                  value={startDate}
                  onChange={handleStart}
                  toneColor={toneMeta.base}
                  max={endDate || undefined}
                />
                {span && (
                  <div className="ip-date-span" role="note" aria-label={`Span: ${span}`}>
                    <span className="ip-date-span-text">{span}</span>
                  </div>
                )}
                <DatePicker
                  label="End"
                  value={endDate}
                  onChange={handleEnd}
                  toneColor={toneMeta.base}
                  min={startDate || undefined}
                />
              </div>
            </div>

          </div>
        </div>

        {isCreate && (
          <div className="ip-footer">
            <button
              className="ip-commit"
              onClick={handleCommit}
              disabled={!canCommit}
              aria-disabled={!canCommit}
            >
              Add
              <CornerDownLeft size={14} className="ip-commit-icon" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
