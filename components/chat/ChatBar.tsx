"use client";

import { useRef, useState } from "react";
import { Check, History, SquarePen, Trash2 } from "lucide-react";
import {
  CHAT,
  menuChrome,
  menuLabel,
  menuRow,
  menuSurface,
  quietControl,
  rowLabel,
  rowMeta,
  useDismiss,
} from "./chrome";
import { formatTokens, MONTHS_SHORT, totalTokens } from "@/lib/types";
import type { ChatSummary, TokenUsage } from "@/lib/types";

interface Props {
  chats: ChatSummary[];
  activeId: string;
  loading?: boolean;
  onOpenMenu: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  usage?: TokenUsage;
  empty: boolean;
}

export function ChatBar({
  chats,
  activeId,
  loading = false,
  onOpenMenu,
  onSelect,
  onDelete,
  onNew,
  usage,
  empty,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, () => setOpen(false), menuRef, triggerRef);

  const total = usage ? totalTokens(usage) : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: CHAT.space.sm,
        padding: `${CHAT.space.xs}px ${CHAT.space.sm}px`,
        borderBottom: "1px solid var(--line)",
        background: "var(--paper)",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 2 }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) onOpenMenu();
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Recent chats (last 7 days)"
          style={quietControl(open)}
          onMouseEnter={(e) => {
            if (!open) e.currentTarget.style.background = "var(--paper-3)";
          }}
          onMouseLeave={(e) => {
            if (!open) e.currentTarget.style.background = "transparent";
          }}
        >
          <History size={CHAT.icon.meta} />
          Recent
        </button>
        <button
          type="button"
          onClick={onNew}
          disabled={empty}
          title={empty ? "This chat is already new" : "Start a new chat"}
          style={{
            ...quietControl(false),
            opacity: empty ? 0.4 : 1,
            cursor: empty ? "default" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!empty) e.currentTarget.style.background = "var(--paper-3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <SquarePen size={CHAT.icon.meta} />
          New
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            className="chat-scroll"
            style={{
              ...menuSurface(8, menuChrome(2)),
              top: "calc(100% + 6px)",
              left: 0,
              width: 278,
              maxWidth: "calc(100vw - 48px)",
            }}
          >
            {loading && chats.length === 0 ? (
              <div style={{ ...menuRow(false), color: "var(--ink-4)", cursor: "default" }}>
                Loading…
              </div>
            ) : chats.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: `${CHAT.space.sm}px ${CHAT.space.sm}px ${CHAT.space.md}px`,
                  fontSize: CHAT.fs.ui,
                  lineHeight: 1.5,
                  color: "var(--ink-4)",
                }}
              >
                No chats yet. Conversations are kept for 7 days, then cleared.
              </p>
            ) : (
              groupByDay(chats).map(([day, items]) => (
                <div key={day}>
                  <div style={menuLabel}>{day}</div>
                  {items.map((c) => (
                    <ChatRow
                      key={c.id}
                      chat={c}
                      active={c.id === activeId}
                      onSelect={() => {
                        setOpen(false);
                        onSelect(c.id);
                      }}
                      onDelete={() => onDelete(c.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {total > 0 && (
        <span
          title={usageTitle(usage!)}
          style={{ ...rowMeta, paddingRight: CHAT.space.xs, cursor: "default" }}
        >
          {formatTokens(total)} tok
          {usage?.costUsd ? ` · ${formatCost(usage.costUsd)}` : ""}
        </span>
      )}
    </div>
  );
}

const DELETE_LANE = 30;

function ChatRow({
  chat,
  active,
  onSelect,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        borderRadius: CHAT.radius.sm,
        background: active ? "var(--forest-soft)" : hover ? "var(--paper-2)" : "transparent",
        transition: `background ${CHAT.duration} ${CHAT.ease}`,
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onSelect}
        style={{
          ...menuRow(false),
          background: "transparent",
          paddingRight: hover ? DELETE_LANE : CHAT.space.sm,
          transition: `padding-right ${CHAT.duration} ${CHAT.ease}`,
        }}
      >
        <span style={rowLabel}>{chat.title}</span>
        {active && (
          <Check size={CHAT.icon.meta} style={{ flexShrink: 0, color: "var(--forest)" }} />
        )}
        {!hover && <span style={rowMeta}>{time(chat.updatedAt)}</span>}
      </button>
      {hover && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete chat"
          aria-label={`Delete ${chat.title}`}
          style={{
            position: "absolute",
            right: CHAT.space.xs,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            borderRadius: CHAT.radius.sm - 2,
            color: "var(--ink-4)",
            cursor: "pointer",
            transition: `color ${CHAT.duration} ${CHAT.ease}, background ${CHAT.duration} ${CHAT.ease}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--delete-icon)";
            e.currentTarget.style.background = "var(--delete-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--ink-4)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Trash2 size={CHAT.icon.meta} />
        </button>
      )}
    </div>
  );
}

function groupByDay(chats: ChatSummary[]): [string, ChatSummary[]][] {
  const out: [string, ChatSummary[]][] = [];
  for (const c of chats) {
    const label = dayLabel(c.updatedAt);
    const last = out[out.length - 1];
    if (last && last[0] === label) last[1].push(c);
    else out.push([label, [c]]);
  }
  return out;
}

function dayLabel(d: Date): string {
  const day = startOfDay(d).getTime();
  const today = startOfDay(new Date()).getTime();
  const diff = Math.round((today - day) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function time(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const suffix = h < 12 ? "am" : "pm";
  return `${((h + 11) % 12) + 1}:${m}${suffix}`;
}

const formatCost = (usd: number) => (usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`);

function usageTitle(u: TokenUsage): string {
  const parts = [`${u.inputTokens.toLocaleString()} in`, `${u.outputTokens.toLocaleString()} out`];
  if (u.cacheWriteTokens) parts.push(`${u.cacheWriteTokens.toLocaleString()} cache write`);
  if (u.cacheReadTokens) parts.push(`${u.cacheReadTokens.toLocaleString()} cache read`);
  if (u.costUsd) parts.push(`$${u.costUsd.toFixed(4)}`);
  return `This chat: ${parts.join(" · ")}`;
}
