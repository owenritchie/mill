"use client";

import { LayersPlus } from "lucide-react";
import { CHAT } from "./chrome";

interface Props {
  onCreateProject: () => void;
}

export function NoWorkspaceNotice({ onCreateProject }: Props) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: CHAT.space.md,
        padding: `${CHAT.space.xl}px ${CHAT.space.xl}px`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: CHAT.radius.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--paper-2)",
          color: "var(--ink-3)",
        }}
      >
        <LayersPlus size={18} strokeWidth={1.8} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: CHAT.space.xs + 2 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontWeight: 400,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Start with a project
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: CHAT.fs.ui,
            lineHeight: 1.6,
            color: "var(--ink-3)",
            maxWidth: 260,
          }}
        >
          Mill&rsquo;s chat thinks about what&rsquo;s in your workspace and builds into it.
          Create a project first, then come back and it&rsquo;ll have something to work with.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreateProject}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: CHAT.space.xs + 2,
          height: CHAT.control + 4,
          padding: `0 ${CHAT.space.lg - 2}px`,
          borderRadius: CHAT.radius.sm,
          border: "none",
          background: "var(--forest)",
          color: "#fff",
          fontSize: CHAT.fs.ui,
          fontFamily: "var(--sans)",
          fontWeight: 500,
          cursor: "pointer",
          transition: `background ${CHAT.duration} ${CHAT.ease}`,
        }}
      >
        <LayersPlus size={CHAT.icon.control} />
        Create a project
      </button>
    </div>
  );
}
