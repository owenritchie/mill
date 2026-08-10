"use client";

import { Plus, Pencil, Trash2, Check } from "lucide-react";
import type { ChatAction } from "@/lib/types";

interface Props {
  actions: ChatAction[];
  state: "proposed" | "applied" | "dismissed";
  applying?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function ActionPlan({ actions, state, applying = false, onApply, onDismiss }: Props) {
  if (!actions.length) return null;

  return (
    <div
      style={{
        marginTop: 8,
        border: "1px solid color-mix(in srgb, var(--forest) 22%, var(--line))",
        background: "color-mix(in srgb, var(--forest-soft) 30%, var(--paper))",
        borderRadius: 12,
        padding: 10,
        maxWidth: "92%",
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-4)",
          marginBottom: 7,
        }}
      >
        {state === "applied" ? "Applied" : state === "dismissed" ? "Dismissed" : "Proposed changes"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {actions.map((a, i) => (
          <ActionRow key={i} action={a} muted={state !== "proposed"} />
        ))}
      </div>

      {state === "proposed" && (
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          <button
            onClick={onApply}
            disabled={applying}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              borderRadius: 7,
              border: "none",
              background: "var(--forest)",
              color: "oklch(97% 0.02 140)",
              fontSize: 12.5,
              fontFamily: "var(--sans)",
              cursor: applying ? "default" : "pointer",
              opacity: applying ? 0.7 : 1,
            }}
          >
            <Check size={13} strokeWidth={2.4} />
            {applying ? "Applying…" : "Apply"}
          </button>
          <button
            onClick={onDismiss}
            disabled={applying}
            style={{
              padding: "5px 12px",
              borderRadius: 7,
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink-3)",
              fontSize: 12.5,
              fontFamily: "var(--sans)",
              cursor: applying ? "default" : "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function ActionRow({ action, muted }: { action: ChatAction; muted: boolean }) {
  const { kind, label } = describe(action);
  const color =
    kind === "delete" ? "#C94040" : kind === "create" ? "var(--forest)" : "var(--ink-3)";
  const Icon = kind === "delete" ? Trash2 : kind === "create" ? Plus : Pencil;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 7,
        fontSize: 12.5,
        lineHeight: 1.4,
        color: "var(--ink)",
        opacity: muted ? 0.6 : 1,
      }}
    >
      <Icon size={13} style={{ flexShrink: 0, marginTop: 2, color }} />
      <span>{label}</span>
    </div>
  );
}

function describe(a: ChatAction): { kind: "create" | "update" | "delete"; label: string } {
  switch (a.type) {
    case "createProject":
      return { kind: "create", label: `New project — “${a.name}”` };
    case "updateProject":
      return { kind: "update", label: `Edit project${a.name ? ` — “${a.name}”` : ""}` };
    case "deleteProject":
      return { kind: "delete", label: "Delete project" };
    case "moveProject":
      return { kind: "update", label: "Move project to another space" };
    case "createTopic": {
      const n = a.decisions?.length ?? 0;
      return {
        kind: "create",
        label: `New topic — “${a.title}”${n ? ` with ${n} decision${n === 1 ? "" : "s"}` : ""}`,
      };
    }
    case "updateTopic":
      return { kind: "update", label: `Edit topic${a.title ? ` — “${a.title}”` : ""}` };
    case "deleteTopic":
      return { kind: "delete", label: "Delete topic" };
    case "createDecision":
      return { kind: "create", label: `New decision — “${a.title}”` };
    case "updateDecision":
      return { kind: "update", label: `Edit decision${a.title ? ` — “${a.title}”` : ""}` };
    case "deleteDecision":
      return { kind: "delete", label: "Delete decision" };
    case "createLink":
      return { kind: "create", label: "Link two topics" };
    case "deleteLink":
      return { kind: "delete", label: "Unlink two topics" };
  }
}
