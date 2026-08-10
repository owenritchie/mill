"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, FishingHook, Loader2, Plus, Trash2 } from "lucide-react";
import { countWords, HOOK_LIMIT, HOOK_WORD_LIMIT } from "@/lib/types";
import type { ChatHook } from "@/lib/types";
import { loadChatHooks, saveChatHooks } from "@/app/actions/config";

interface Props {
  onSaved: () => void;
}

export function HooksSection({ onSaved }: Props) {
  const [hooks, setHooks] = useState<ChatHook[]>([]);
  const [saved, setSaved] = useState<ChatHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadChatHooks();
      if (cancelled) return;
      setHooks(res.hooks);
      setSaved(res.hooks);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (id: string, patch: Partial<ChatHook>) =>
    setHooks((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const add = () => {
    const hook = { id: crypto.randomUUID(), name: "", prompt: "" };
    setHooks((prev) => [...prev, hook]);
    setOpenId(hook.id);
  };

  const remove = (id: string) => {
    setHooks((prev) => prev.filter((h) => h.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  };

  const overLimit = hooks.some((h) => countWords(h.prompt) > HOOK_WORD_LIMIT);
  const incomplete = hooks.some((h) => !h.name.trim() || !h.prompt.trim());
  const dirty = JSON.stringify(hooks) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveChatHooks(hooks);
      setHooks(next);
      setSaved(next);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
      onSaved();
    } catch {
      setError("Could not save your hooks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <FishingHook size={14} style={{ color: "var(--forest)" }} />
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Hooks</h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-4)" }}>
        Rules for chat. Use them to reach MCP servers, follow a habit or perform
        specific instructions.
      </p>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-4)" }}>
          <Loader2 size={13} style={{ animation: "millSpin 0.7s linear infinite" }} /> Loading hooks
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {hooks.length === 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-4)", fontStyle: "italic" }}>
              No hooks yet.
            </p>
          )}

          {hooks.map((h, i) => (
            <HookRow
              key={h.id}
              hook={h}
              index={i}
              open={openId === h.id}
              onToggle={() => setOpenId((cur) => (cur === h.id ? null : h.id))}
              onChange={(patch) => update(h.id, patch)}
              onRemove={() => remove(h.id)}
            />
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <AddHookButton onClick={add} disabled={hooks.length >= HOOK_LIMIT} />

            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || overLimit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid transparent",
                background: !dirty || overLimit || saving ? "var(--paper-3)" : "var(--forest)",
                color: !dirty || overLimit || saving ? "var(--ink-4)" : "oklch(97% 0.02 140)",
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: "var(--sans)",
                cursor: !dirty || overLimit || saving ? "not-allowed" : "pointer",
              }}
            >
              {saving && <Loader2 size={13} style={{ animation: "millSpin 0.7s linear infinite" }} />}
              {saving ? "Saving" : "Save hooks"}
            </button>

            {justSaved && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--forest)", fontWeight: 500 }}>
                <Check size={14} /> Saved
              </span>
            )}
            {error && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--rose)", fontWeight: 500 }}>
                <AlertTriangle size={14} /> {error}
              </span>
            )}
          </div>

          {(overLimit || incomplete) && (
            <p style={{ margin: 0, fontSize: 11.5, color: over(overLimit), lineHeight: 1.5 }}>
              {overLimit
                ? `Trim the hooks over ${HOOK_WORD_LIMIT} words before saving.`
                : "Hooks missing a name or a prompt are dropped when you save."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const over = (isOver: boolean) => (isOver ? "var(--rose)" : "var(--ink-4)");

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12.5,
  fontFamily: "var(--sans)",
  color: "var(--ink)",
  background: "var(--paper)",
  outline: "none",
  transition: "border-color 0.14s",
};

const focusField = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "var(--forest)";
};

const blurField = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, isOver: boolean) => {
  e.currentTarget.style.borderColor = isOver ? "var(--rose)" : "var(--line)";
};

function HookRow({
  hook,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  hook: ChatHook;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ChatHook>) => void;
  onRemove: () => void;
}) {
  const words = countWords(hook.prompt);
  const isOver = words > HOOK_WORD_LIMIT;
  const name = hook.name.trim();
  const preview = hook.prompt.trim();

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  return (
    <div
      ref={cardRef}
      style={{
        scrollMargin: 14,
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: open ? "var(--paper-2)" : "var(--paper)",
        overflow: "hidden",
        transition: "background 0.14s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 4px 0 10px",
            border: "none",
            background: "transparent",
            fontFamily: "var(--sans)",
            fontSize: 12.5,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <ChevronRight
            size={13}
            style={{
              flexShrink: 0,
              color: "var(--ink-4)",
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 0.14s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
          <span
            style={{
              flexShrink: 0,
              fontWeight: 500,
              color: name ? "var(--ink)" : "var(--ink-4)",
              fontStyle: name ? "normal" : "italic",
              maxWidth: 150,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: 4,
            }}
          >
            {name || `Hook ${index + 1}`}
          </span>
          {!open && preview && (
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11.5,
                color: isOver ? "var(--rose)" : "var(--ink-4)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {preview}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Delete hook"
          aria-label={`Delete ${name || `hook ${index + 1}`}`}
          style={{
            width: 28,
            height: 28,
            margin: "0 5px 0 4px",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: "var(--ink-4)",
            cursor: "pointer",
            transition: "color 0.12s, background 0.12s",
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
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 10px 10px" }}>
          <input
            value={hook.name}
            onChange={(e) => onChange({ name: e.target.value.slice(0, 60) })}
            placeholder={`Hook ${index + 1} name, e.g. "Todoist tasks"`}
            style={{ ...fieldStyle, height: 32, padding: "0 10px" }}
            onFocus={focusField}
            onBlur={(e) => blurField(e, false)}
          />
          <textarea
            value={hook.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            rows={3}
            placeholder="What should the model do when this hook is on?"
            style={{
              ...fieldStyle,
              resize: "vertical",
              minHeight: 62,
              padding: "8px 10px",
              lineHeight: 1.5,
              borderColor: isOver ? "var(--rose)" : "var(--line)",
            }}
            onFocus={focusField}
            onBlur={(e) => blurField(e, isOver)}
          />
          <div
            style={{
              alignSelf: "flex-end",
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              color: over(isOver),
            }}
          >
            {words}/{HOOK_WORD_LIMIT} words
          </div>
        </div>
      )}
    </div>
  );
}

function AddHookButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${HOOK_LIMIT} hooks is the limit` : "Add a hook"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 11px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "transparent",
        color: "var(--ink-4)",
        fontSize: 12.5,
        fontFamily: "var(--sans)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition:
          "background 0.2s cubic-bezier(0.22, 1, 0.36, 1), color 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "var(--forest-soft)";
        e.currentTarget.style.color = "var(--forest)";
        e.currentTarget.style.borderColor = "var(--forest-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--ink-4)";
        e.currentTarget.style.borderColor = "var(--line)";
      }}
    >
      <Plus size={12} />
      Add hook
    </button>
  );
}
