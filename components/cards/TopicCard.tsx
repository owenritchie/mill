"use client";

import { Maximize2, Trash2, ChevronDown } from "lucide-react";
import { Topic } from "@/lib/types";
import { HashTag, PriorityTag } from "@/components/primitives/Tag";

interface Props {
  topic: Topic;
  index: number;
  active: boolean;
  tagMatch?: boolean;
  dragging?: boolean;
  canvasMode?: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onExpand: () => void;
  onToggleCollapsed?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

export function TopicCard({
  topic,
  index,
  active,
  tagMatch = false,
  dragging = false,
  canvasMode = false,
  onActivate,
  onDelete,
  onExpand,
  onToggleCollapsed,
  onDragStart,
}: Props) {
  const tone = topic.tone ?? "ink";
  const collapsed = !!topic.collapsed;

  const cardStyle: React.CSSProperties | undefined = dragging
    ? {
        borderColor: "color-mix(in srgb, var(--tone) 40%, var(--line))",
        boxShadow: "0 12px 24px oklch(14% 0.008 85 / 0.12), 0 28px 52px oklch(14% 0.008 85 / 0.18)",
      }
    : tagMatch && !active
      ? {
          borderColor: "var(--tone)",
          boxShadow: "0 0 0 1.5px var(--tone), 0 10px 28px oklch(14% 0.008 85 / 0.12)",
        }
      : undefined;

  return (
    <div
      className={[
        "cv-card-outer",
        "ic-card",
        `tone-${tone}`,
        canvasMode ? "cv-draggable" : "",
        active ? "is-active" : "",
        collapsed ? "is-collapsed" : "",
      ].filter(Boolean).join(" ")}
      style={dragging ? { transform: "scale(1.025)" } : undefined}
      onClick={onActivate}
      onPointerDown={canvasMode ? (e) => onDragStart?.(e) : undefined}
    >
      <div
        className="cv-card"
        style={cardStyle}
      >
        <div
          className="cv-card-header"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="cv-topic-num">{String(index + 1).padStart(2, "0")}</span>

          {collapsed ? (
            <>
              <span className="cv-strip-sep">·</span>
              <span className="cv-topic-title-mini">{topic.title || "Untitled"}</span>
            </>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <div className="cv-card-actions">
            <button
              className="cv-expand-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onExpand(); }}
              title="Open detail view"
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="cv-card-delete"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
            {canvasMode && (
              <button
                className={"cv-collapse-btn" + (collapsed ? " is-collapsed" : "")}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onToggleCollapsed?.(); }}
              >
                <ChevronDown size={15} />
              </button>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="cv-card-body" style={{ paddingBottom: topic.decisions.length > 0 ? 0 : 12 }}>
            <h3 className="cv-topic-title">{topic.title || "Untitled"}</h3>

            {topic.summary && (
              <p className="cv-topic-summary" style={{ marginBottom: 8 }}>
                {topic.summary}
              </p>
            )}

            {(topic.priority || (topic.tags ?? []).length > 0) && (
              <div className="cv-card-meta" style={{ marginBottom: 6 }}>
                {topic.priority && <PriorityTag priority={topic.priority} />}
                {(topic.tags ?? []).map((tag) => (
                  <HashTag key={tag} label={tag} />
                ))}
              </div>
            )}

            {topic.decisions.length > 0 && (
              <div className="ic-decisions">
                <div className="ic-dl-label">
                  Decisions <span className="ic-dl-count">[{topic.decisions.length}]</span>
                </div>
                {topic.decisions.slice(0, 5).map((d, di) => (
                  <div key={d.id} className="ic-decision-row">
                    <span className="ic-deci-num">{String(di + 1).padStart(2, "0")}</span>
                    <span className="ic-deci-title">
                      {d.title || (
                        <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Untitled</span>
                      )}
                    </span>
                  </div>
                ))}
                {topic.decisions.length > 5 && (
                  <div className="ic-more">+{topic.decisions.length - 5} more</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
