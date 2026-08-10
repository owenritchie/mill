"use client";

import { useState } from "react";
import { FilePlus, LayersPlus, Lightbulb, ScrollText } from "lucide-react";
import { CHAT } from "./chrome";
import type { ChatMode } from "@/lib/types";

interface QuickAction {
  label: string;
  prompt: string;
  mode: ChatMode;
  Icon: typeof LayersPlus;
}

const ACTIONS: QuickAction[] = [
  {
    label: "Create a project",
    prompt: "I want to start a new project. Help me set it up.",
    mode: "build",
    Icon: LayersPlus,
  },
  {
    label: "Add a topic",
    prompt: "Add a new topic to my current project.",
    mode: "build",
    Icon: FilePlus,
  },
  {
    label: "Plan a feature",
    prompt: "Help me plan a new feature — let's think through the key decisions.",
    mode: "plan",
    Icon: Lightbulb,
  },
  {
    label: "Summarize my workspace",
    prompt: "Give me a quick summary of what's in my workspace right now.",
    mode: "plan",
    Icon: ScrollText,
  },
];

interface Props {
  hidden: boolean;
  disabled?: boolean;
  onPick: (prompt: string, mode: ChatMode) => void;
}

export function QuickActions({ hidden, disabled = false, onPick }: Props) {
  const [gone, setGone] = useState(false);

  if (gone && !hidden) setGone(false);

  if (gone) return null;

  return (
    <div
      onTransitionEnd={() => {
        if (hidden) setGone(true);
      }}
      style={{
        overflow: "hidden",
        maxHeight: hidden ? 0 : 200,
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translateY(-4px)" : "none",
        transition: "max-height 0.28s ease, opacity 0.2s ease, transform 0.2s ease",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: CHAT.space.xs + 2,
          padding: `0 ${CHAT.space.lg}px ${CHAT.space.md}px`,
        }}
      >
        {ACTIONS.map(({ label, prompt, mode, Icon }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(prompt, mode)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: CHAT.space.xs + 2,
              height: CHAT.control,
              padding: `0 ${CHAT.space.md - 1}px`,
              borderRadius: CHAT.radius.sm,
              border: "1px solid var(--line)",
              background: "var(--paper)",
              color: "var(--ink-2)",
              fontSize: CHAT.fs.ui,
              fontFamily: "var(--sans)",
              cursor: disabled ? "default" : "pointer",
              transition: `background ${CHAT.duration} ${CHAT.ease}, border-color ${CHAT.duration} ${CHAT.ease}, color ${CHAT.duration} ${CHAT.ease}`,
            }}
            onMouseEnter={(e) => {
              if (disabled) return;
              e.currentTarget.style.background = "var(--forest-soft)";
              e.currentTarget.style.borderColor = "var(--forest-soft)";
              e.currentTarget.style.color = "var(--forest)";
              const icon = e.currentTarget.firstElementChild as HTMLElement | null;
              if (icon) icon.style.color = "var(--forest)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--paper)";
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.color = "var(--ink-2)";
              const icon = e.currentTarget.firstElementChild as HTMLElement | null;
              if (icon) icon.style.color = "var(--ink-4)";
            }}
          >
            <Icon
              size={CHAT.icon.meta}
              style={{
                color: "var(--ink-4)",
                flexShrink: 0,
                transition: `color ${CHAT.duration} ${CHAT.ease}`,
              }}
            />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
