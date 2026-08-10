"use client";

import { useEffect, type CSSProperties, type RefObject } from "react";

const fs = {
  meta: 11,
  ui: 12.5,
  body: 14,
  title: 15,
} as const;

const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

const radius = { sm: 6, md: 10, lg: 14 } as const;

const icon = { meta: 12, control: 14, title: 16 } as const;

const control = 28;

const row = 32;

const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const duration = "0.18s";

export const CHAT = { fs, space, radius, icon, control, row, ease, duration } as const;

const LABEL_H = 22;
const DIVIDER_H = 9;

export const menuChrome = (labels: number, dividers = 0) =>
  labels * LABEL_H + dividers * DIVIDER_H;

export function menuSurface(maxRows: number, chrome = 0): CSSProperties {
  return {
    position: "absolute",
    zIndex: 40,
    background: "var(--paper)",
    border: "1px solid var(--line)",
    borderRadius: radius.md,
    boxShadow:
      "0 16px 32px -12px rgba(30,33,43,0.18), 0 2px 6px -2px rgba(30,33,43,0.08)",
    padding: space.xs,
    maxHeight: maxRows * row + chrome + space.xs * 2,
    overflowY: "auto",
    overscrollBehavior: "contain",
    animation: `chatMenuIn ${duration} ${ease}`,
  };
}

export function menuRow(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: space.sm,
    width: "100%",
    height: row,
    padding: `0 ${space.sm}px`,
    borderRadius: radius.sm,
    border: "none",
    background: active ? "var(--forest-soft)" : "transparent",
    color: "var(--ink)",
    fontSize: fs.ui,
    fontFamily: "var(--sans)",
    textAlign: "left",
    cursor: "pointer",
    transition: `background ${duration} ${ease}`,
  };
}

export const menuLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: LABEL_H,
  padding: `0 ${space.sm}px`,
  fontSize: 10,
  fontFamily: "var(--mono)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ink-4)",
};

export const menuDivider: CSSProperties = {
  height: 1,
  background: "var(--line)",
  margin: `${space.xs}px ${space.xs}px`,
};

export const rowMeta: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: fs.meta,
  color: "var(--ink-4)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

export const rowLabel: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export function quietControl(open: boolean, on = false): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: space.xs + 1,
    height: control,
    padding: `0 ${space.sm}px`,
    borderRadius: radius.sm,
    border: "none",
    background: open ? "var(--paper-3)" : "transparent",
    color: on ? "var(--forest)" : "var(--ink-3)",
    fontFamily: "var(--mono)",
    fontSize: fs.meta,
    cursor: "pointer",
    transition: `background ${duration} ${ease}, color ${duration} ${ease}`,
  };
}

export const iconControl: CSSProperties = {
  width: control,
  height: control,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
  border: "none",
  background: "transparent",
  color: "var(--ink-3)",
  cursor: "pointer",
  transition: `background ${duration} ${ease}, color ${duration} ${ease}`,
};

export function useDismiss(
  open: boolean,
  close: () => void,
  ...refs: RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);
}

export const CHAT_CHROME_CSS = `
  @keyframes chatMenuIn {
    from { opacity: 0; transform: translateY(4px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .chat-scroll::-webkit-scrollbar { width: 6px; }
  .chat-scroll::-webkit-scrollbar-track { background: transparent; }
  .chat-scroll::-webkit-scrollbar-thumb {
    background: var(--line-strong); border-radius: 3px; border: 2px solid var(--paper);
  }
  .chat-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-4); }
`;
