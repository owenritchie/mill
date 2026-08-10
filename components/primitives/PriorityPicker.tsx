"use client";

import { useRef, useState, useEffect } from "react";
import { Flag } from "lucide-react";
import { Priority, PRIORITY_META } from "@/lib/types";

interface Props {
  priority: Priority | null;
  onChange: (p: Priority | null) => void;
}

export function PriorityPicker({ priority, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = priority ? PRIORITY_META[priority] : null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="priority-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        className={"priority-trigger" + (current ? " has-value" : "")}
        style={current ? ({ "--p-color": current.color, "--p-soft": current.soft } as React.CSSProperties) : {}}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag
          size={11}
          style={{ color: current ? current.color : "var(--ink-4)", fill: current ? current.color : "none" }}
        />
        <span>{current ? current.label : "Priority"}</span>
      </button>

      {open && (
        <div className="priority-pop">
          {priority && (
            <button
              className="priority-option priority-clear"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Clear
            </button>
          )}
          {(Object.entries(PRIORITY_META) as [Priority, typeof PRIORITY_META[Priority]][]).map(([key, p]) => (
            <button
              key={key}
              className={"priority-option" + (priority === key ? " is-current" : "")}
              onClick={() => { onChange(key); setOpen(false); }}
            >
              <Flag size={11} style={{ color: p.color, fill: p.color }} />
              <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
              <span className="p-desc">{p.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
