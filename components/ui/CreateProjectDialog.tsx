"use client";

import { useEffect, useRef, useState } from "react";
import { LayersPlus } from "lucide-react";

interface CreateProjectDialogProps {
  title?: string;
  detail?: string;
  confirmLabel?: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

const DEFAULT_NAME = "Untitled project";

export function CreateProjectDialog({
  title = "Create a project first",
  detail = "Topics live inside a project. Name one to start adding topics.",
  confirmLabel = "Create project",
  onCreate,
  onCancel,
}: CreateProjectDialogProps) {
  const [name, setName] = useState(DEFAULT_NAME);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const submit = () => onCreate(name.trim() || DEFAULT_NAME);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        submit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, onCancel]);

  return (
    <div
      className="confirm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: 360 }}
      >
        <div
          className="confirm-icon"
          aria-hidden
          style={{ color: "var(--forest)", background: "var(--forest-soft)" }}
        >
          <LayersPlus size={18} />
        </div>
        <p className="confirm-title">{title}</p>
        <p className="confirm-detail">{detail}</p>

        <input
          ref={inputRef}
          className="confirm-input"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this project…"
          aria-label="Project name"
          autoComplete="off"
          spellCheck={false}
          style={{ textAlign: "left" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--forest)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line-strong)"; }}
        />

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="confirm-create"
            onClick={submit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
