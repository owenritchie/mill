"use client";

import { Flag } from "lucide-react";
import { Priority, PRIORITY_META } from "@/lib/types";

export function Tag({
  variant,
  color,
  className = "",
  children,
  ...rest
}: {
  variant?: "hash" | "priority";
  color?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={["tag", variant && `tag--${variant}`, className].filter(Boolean).join(" ")}
      style={color ? ({ "--tag-color": color } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </span>
  );
}

export function HashTag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <Tag variant="hash">
      <span className="tag-hash">#</span>
      {label}
      {onRemove && (
        <button
          className="tag-remove"
          aria-label={`Remove #${label}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </Tag>
  );
}

export function PriorityTag({ priority, showDesc = false }: { priority: Priority; showDesc?: boolean }) {
  const p = PRIORITY_META[priority];
  return (
    <Tag variant="priority" color={p.color}>
      <Flag size={9} style={{ fill: p.color, color: p.color }} />
      {p.label}
      {showDesc && <span className="tag-desc">{p.desc}</span>}
    </Tag>
  );
}
