"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { ArrowUp, Check, ChevronDown } from "lucide-react";
import { HookPicker } from "./HookPicker";
import {
  CHAT,
  menuChrome,
  menuDivider,
  menuLabel,
  menuRow,
  menuSurface,
  quietControl,
  rowLabel,
  rowMeta,
  useDismiss,
} from "./chrome";
import {
  modelMeta,
  claudeModelLabel,
  CLAUDE_MODEL_ALIASES,
  type ChatHook,
  type OllamaModel,
  type AiProvider,
  type ChatMode,
} from "@/lib/types";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  pending?: boolean;
  onStop?: () => void;
  hooks: ChatHook[];
  selectedHookIds: string[];
  onHooksChange: (ids: string[]) => void;
  onManageHooks: () => void;
  placeholder?: string;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  provider: AiProvider;
  ollamaModel: string;
  claudeModel: string;
  claudeVersions: Record<string, string>;
  ollamaModels: OllamaModel[];
  loadingModels?: boolean;
  onSelectOllama: (name: string) => void;
  onSelectClaude: (alias: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  pending = false,
  onStop,
  hooks,
  selectedHookIds,
  onHooksChange,
  onManageHooks,
  placeholder,
  mode,
  onModeChange,
  provider,
  ollamaModel,
  claudeModel,
  claudeVersions,
  ollamaModels,
  loadingModels = false,
  onSelectOllama,
  onSelectClaude,
}: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismiss(menuOpen, () => setMenuOpen(false), menuRef, triggerRef);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const canSend = !!value.trim() && !disabled;

  const isClaude = provider === "claude_cli";
  const providerLabel = isClaude ? "Claude" : "Ollama";
  const modelText = isClaude
    ?
      claudeModelLabel(claudeModel).replace(/^claude-/i, "")
    : ollamaModel || (loadingModels ? "Loading…" : "No model");
  const triggerText = `${providerLabel} · ${modelText}`;

  return (
    <div
      style={{
        padding: `${CHAT.space.sm}px ${CHAT.space.md}px ${CHAT.space.md}px`,
        background: "var(--paper)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${focused ? "var(--forest)" : "var(--line)"}`,
          background: "var(--paper)",
          borderRadius: CHAT.radius.lg,
          transition: `border-color ${CHAT.duration} ${CHAT.ease}`,
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={placeholder ?? (pending ? "Waiting for a reply…" : "Ask anything…")}
          rows={1}
          style={{
            border: "none",
            background: "transparent",
            padding: `${CHAT.space.md}px ${CHAT.space.md}px ${CHAT.space.xs}px`,
            fontSize: CHAT.fs.body,
            lineHeight: 1.5,
            outline: "none",
            resize: "none",
            color: "var(--ink)",
            fontFamily: "var(--sans)",
            overflow: "hidden",
            cursor: disabled ? "not-allowed" : "text",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${CHAT.space.xs + 2}px ${CHAT.space.xs + 2}px`,
            gap: CHAT.space.xs,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0, flex: 1 }}>
            <ModeToggle mode={mode} onChange={onModeChange} disabled={disabled} />

            <div style={{ display: "flex", minWidth: 0, flex: "1 1 auto" }}>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                title={`Switch provider or model. Currently ${triggerText}`}
                style={{ ...quietControl(menuOpen), minWidth: 0, maxWidth: "100%" }}
                onMouseEnter={(e) => {
                  if (!menuOpen) e.currentTarget.style.background = "var(--paper-3)";
                }}
                onMouseLeave={(e) => {
                  if (!menuOpen) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={rowLabel}>{triggerText}</span>
                <ChevronDown
                  size={CHAT.icon.meta}
                  style={{
                    flexShrink: 0,
                    opacity: 0.6,
                    transition: `transform ${CHAT.duration} ${CHAT.ease}`,
                    transform: menuOpen ? "rotate(180deg)" : "none",
                  }}
                />
              </button>

              {menuOpen && (
                <div
                  ref={menuRef}
                  role="listbox"
                  className="chat-scroll"
                  style={{
                    ...menuSurface(6, menuChrome(2, 1)),
                    bottom: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                  }}
                >
                  <div style={menuLabel}>Ollama</div>
                  {ollamaModels.length === 0 ? (
                    <div
                      style={{
                        ...menuRow(false),
                        color: "var(--ink-4)",
                        cursor: "default",
                      }}
                    >
                      {loadingModels ? "Looking for models…" : "No models found. Is Ollama running?"}
                    </div>
                  ) : (
                    ollamaModels.map((m) => (
                      <Row
                        key={`ollama:${m.name}`}
                        name={m.name}
                        meta={modelMeta(m)}
                        selected={provider === "ollama" && m.name === ollamaModel}
                        onClick={() => {
                          onSelectOllama(m.name);
                          setMenuOpen(false);
                        }}
                      />
                    ))
                  )}

                  <div style={menuDivider} />

                  <div style={menuLabel}>Claude CLI</div>
                  {isClaude && !(CLAUDE_MODEL_ALIASES as readonly string[]).includes(claudeModel) && (
                    <Row
                      name={claudeModel}
                      meta="pinned"
                      selected
                      onClick={() => setMenuOpen(false)}
                    />
                  )}
                  {CLAUDE_MODEL_ALIASES.map((alias) => (
                    <Row
                      key={`claude:${alias}`}
                      name={claudeModelLabel(alias)}
                      meta={claudeVersions[alias] ?? ""}
                      selected={provider === "claude_cli" && alias === claudeModel}
                      onClick={() => {
                        onSelectClaude(alias);
                        setMenuOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <HookPicker
              hooks={hooks}
              selected={selectedHookIds}
              onChange={onHooksChange}
              onManage={onManageHooks}
              disabled={disabled}
            />
          </div>

          {pending ? (
            <button
              onClick={() => onStop?.()}
              title="Stop"
              aria-label="Stop generating"
              style={{
                ...actionButton,
                background: "var(--forest)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2.5,
                  background: "currentColor",
                }}
              />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              title="Send"
              aria-label="Send"
              style={{
                ...actionButton,
                background: canSend ? "var(--forest)" : "var(--paper-3)",
                color: canSend ? "#fff" : "var(--ink-4)",
                cursor: canSend ? "pointer" : "default",
              }}
            >
              <ArrowUp size={CHAT.icon.control} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const actionButton: React.CSSProperties = {
  width: CHAT.control,
  height: CHAT.control,
  borderRadius: CHAT.radius.sm,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  flexShrink: 0,
  transition: `background ${CHAT.duration} ${CHAT.ease}, color ${CHAT.duration} ${CHAT.ease}`,
};

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}) {
  const segments: { value: ChatMode; label: string; title: string }[] = [
    { value: "plan", label: "Plan", title: "Plan: think only, no changes" },
    { value: "build", label: "Build", title: "Build: propose changes" },
  ];
  return (
    <div
      role="group"
      aria-label="Chat mode"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        height: CHAT.control,
        padding: 2,
        borderRadius: CHAT.radius.sm,
        background: "var(--paper-2)",
        flexShrink: 0,
      }}
    >
      {segments.map(({ value, label, title }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => !disabled && onChange(value)}
            disabled={disabled}
            aria-pressed={active}
            title={title}
            style={{
              height: CHAT.control - 6,
              padding: `0 ${CHAT.space.sm - 1}px`,
              borderRadius: CHAT.radius.sm - 2,
              border: "none",
              background: active ? "var(--paper)" : "transparent",
              color: active ? "var(--forest)" : "var(--ink-4)",
              boxShadow: active ? "0 1px 2px rgba(30,33,43,0.08)" : "none",
              fontFamily: "var(--mono)",
              fontSize: CHAT.fs.meta,
              cursor: disabled ? "default" : "pointer",
              transition: `background ${CHAT.duration} ${CHAT.ease}, color ${CHAT.duration} ${CHAT.ease}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Row({
  name,
  meta,
  selected,
  onClick,
}: {
  name: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={menuRow(selected)}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--paper-2)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={rowLabel}>{name}</span>
      {meta && <span style={rowMeta}>{meta}</span>}
      {selected && (
        <Check size={CHAT.icon.meta} style={{ flexShrink: 0, color: "var(--forest)" }} />
      )}
    </button>
  );
}
