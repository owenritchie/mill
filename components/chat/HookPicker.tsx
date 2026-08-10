"use client";

import { useRef, useState } from "react";
import { Check, FishingHook, Settings2 } from "lucide-react";
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
import type { ChatHook } from "@/lib/types";

interface Props {
  hooks: ChatHook[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onManage: () => void;
  disabled?: boolean;
}

export function HookPicker({ hooks, selected, onChange, onManage, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, () => setOpen(false), menuRef, triggerRef);

  const live = new Set(hooks.map((h) => h.id));
  const on = selected.filter((id) => live.has(id));
  const count = on.length;
  const allOn = hooks.length > 0 && count === hooks.length;
  const active = count > 0;

  const toggle = (id: string) => {
    const next = new Set(on);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={
          hooks.length === 0
            ? "Hooks: add one in Settings"
            : active
              ? `${count} hook${count === 1 ? "" : "s"} on`
              : "Hooks: none on"
        }
        style={{
          ...quietControl(open, active),
          padding: active ? `0 ${CHAT.space.sm}px` : 0,
          width: active ? undefined : CHAT.control,
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          if (!open && !disabled) e.currentTarget.style.background = "var(--paper-3)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <FishingHook size={CHAT.icon.control} strokeWidth={1.9} />
        {active && <span>{count}</span>}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Hooks"
          className="chat-scroll"
          style={{
            ...menuSurface(7, menuChrome(1, 1)),
            bottom: "calc(100% + 6px)",
            right: 0,
            width: 250,
            maxWidth: "calc(100vw - 48px)",
          }}
        >
          <div style={{ ...menuLabel, justifyContent: "space-between" }}>
            <span>Hooks</span>
            {hooks.length > 0 && (
              <button
                type="button"
                onClick={() => onChange(allOn ? [] : hooks.map((h) => h.id))}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--forest)",
                  cursor: "pointer",
                }}
              >
                {allOn ? "Clear" : "All"}
              </button>
            )}
          </div>

          {hooks.length === 0 ? (
            <div style={{ padding: `${CHAT.space.xs}px ${CHAT.space.sm}px ${CHAT.space.sm}px` }}>
              <p
                style={{
                  margin: `0 0 ${CHAT.space.md}px`,
                  fontSize: CHAT.fs.ui,
                  lineHeight: 1.5,
                  color: "var(--ink-3)",
                }}
              >
                Short standing instructions. Use one to point the chat at an MCP server,
                or at a habit you always want followed.
              </p>
              <button type="button" onClick={onManage} style={manageBtn}>
                <Settings2 size={CHAT.icon.meta} /> Add a hook
              </button>
            </div>
          ) : (
            <>
              {hooks.map((h) => {
                const checked = on.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(h.id)}
                    title={h.prompt}
                    style={menuRow(checked)}
                    onMouseEnter={(e) => {
                      if (!checked) e.currentTarget.style.background = "var(--paper-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (!checked) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={rowLabel}>{h.name}</span>
                    {checked && (
                      <Check
                        size={CHAT.icon.meta}
                        style={{ flexShrink: 0, color: "var(--forest)" }}
                      />
                    )}
                  </button>
                );
              })}
              <div style={menuDivider} />
              <button
                type="button"
                onClick={onManage}
                style={{ ...menuRow(false), color: "var(--ink-3)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--paper-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Settings2 size={CHAT.icon.meta} style={{ flexShrink: 0 }} />
                <span style={rowLabel}>Manage hooks</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const manageBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: CHAT.space.xs + 2,
  height: CHAT.control,
  padding: `0 ${CHAT.space.md}px`,
  borderRadius: CHAT.radius.sm,
  border: "1px solid var(--line)",
  background: "var(--paper)",
  color: "var(--ink-2)",
  fontSize: CHAT.fs.ui,
  fontFamily: "var(--sans)",
  cursor: "pointer",
};
