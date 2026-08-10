"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  detail?: string;
  confirmLabel?: string;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  detail,
  confirmLabel = "Delete",
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const ready = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase();

  useEffect(() => {
    if (requireText) inputRef.current?.focus();
    else confirmRef.current?.focus();
  }, [requireText]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
      } else if (e.key === "Enter" && ready) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ready, onConfirm, onCancel]);

  return (
    <div
      className="confirm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="confirm-card" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="confirm-icon" aria-hidden><Trash2 size={17} /></div>
        <p className="confirm-title">{title}</p>
        {detail && <p className="confirm-detail">{detail}</p>}

        {requireText && (
          <input
            ref={inputRef}
            className="confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type “${requireText}” to confirm`}
            aria-label={`Type ${requireText} to confirm`}
            autoComplete="off"
            spellCheck={false}
          />
        )}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>Cancel</button>
          <button
            ref={confirmRef}
            className="confirm-delete"
            onClick={onConfirm}
            disabled={!ready}
            aria-disabled={!ready}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
