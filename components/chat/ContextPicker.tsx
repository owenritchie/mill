"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  CHAT,
  menuChrome,
  menuDivider,
  menuLabel,
  menuRow,
  menuSurface,
  quietControl,
  rowLabel,
  useDismiss,
} from "./chrome";
import type { Space } from "@/lib/types";

interface Props {
  spaces: Space[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function ContextPicker({ spaces, selected, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, () => setOpen(false), menuRef, triggerRef);

  const sel = new Set(selected);
  const allProjects = spaces.flatMap((s) => s.projects);
  const isAll = sel.size === 0;

  const toggleProject = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const toggleSpace = (space: Space) => {
    const ids = space.projects.map((p) => p.id);
    const allOn = ids.length > 0 && ids.every((id) => sel.has(id));
    const next = new Set(sel);
    for (const id of ids) {
      if (allOn) next.delete(id);
      else next.add(id);
    }
    onChange([...next]);
  };

  const label = isAll
    ? "Whole workspace"
    : sel.size === 1
      ? allProjects.find((p) => sel.has(p.id))?.name ?? "1 project"
      : `${sel.size} projects`;

  return (
    <div style={{ position: "relative", display: "flex", minWidth: 0, flexShrink: 1 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose what the chat can see"
        style={{
          ...quietControl(open, !isAll),
          maxWidth: "100%",
          cursor: disabled ? "default" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!open && !disabled) e.currentTarget.style.background = "var(--paper-3)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={rowLabel}>{label}</span>
        <ChevronDown
          size={CHAT.icon.meta}
          style={{
            flexShrink: 0,
            opacity: 0.6,
            transition: `transform ${CHAT.duration} ${CHAT.ease}`,
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          className="chat-scroll"
          style={{
            ...menuSurface(8, menuChrome(2, 1)),
            top: "calc(100% + 6px)",
            right: 0,
            width: 250,
            maxWidth: "calc(100vw - 48px)",
          }}
        >
          <Option label="Whole workspace" checked={isAll} onClick={() => onChange([])} />
          {spaces.length > 0 && <div style={menuDivider} />}
          {spaces.map((space) => {
            const ids = space.projects.map((p) => p.id);
            const allOn = ids.length > 0 && ids.every((id) => sel.has(id));
            return (
              <div key={space.id}>
                <button
                  type="button"
                  onClick={() => toggleSpace(space)}
                  title={`Toggle every project in ${space.name}`}
                  style={{
                    ...menuLabel,
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    borderRadius: CHAT.radius.sm,
                    cursor: "pointer",
                    transition: `background ${CHAT.duration} ${CHAT.ease}, color ${CHAT.duration} ${CHAT.ease}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--paper-2)";
                    e.currentTarget.style.color = "var(--ink-3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--ink-4)";
                  }}
                >
                  <span style={rowLabel}>{space.name}</span>
                  {allOn && (
                    <Check size={CHAT.icon.meta} style={{ flexShrink: 0, color: "var(--forest)" }} />
                  )}
                </button>
                {space.projects.map((p) => (
                  <Option
                    key={p.id}
                    label={p.name}
                    checked={sel.has(p.id)}
                    onClick={() => toggleProject(p.id)}
                  />
                ))}
                {space.projects.length === 0 && (
                  <div
                    style={{
                      ...menuRow(false),
                      color: "var(--ink-4)",
                      fontStyle: "italic",
                      cursor: "default",
                    }}
                  >
                    No projects
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Option({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onClick}
      style={menuRow(checked)}
      onMouseEnter={(e) => {
        if (!checked) e.currentTarget.style.background = "var(--paper-2)";
      }}
      onMouseLeave={(e) => {
        if (!checked) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={rowLabel}>{label}</span>
      {checked && <Check size={CHAT.icon.meta} style={{ flexShrink: 0, color: "var(--forest)" }} />}
    </button>
  );
}
