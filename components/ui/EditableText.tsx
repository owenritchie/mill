"use client";

import { useRef, useState, useEffect, ElementType, KeyboardEvent } from "react";

interface Props {
  tag?: ElementType;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  stopPropagation?: boolean;
  requireDoubleClick?: boolean;
  maxLength?: number;
}

export function EditableText({
  tag: Tag = "div",
  value,
  onChange,
  className = "",
  placeholder = "",
  multiline = false,
  stopPropagation = false,
  requireDoubleClick = false,
  maxLength,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(!requireDoubleClick);

  useEffect(() => {
    if (!requireDoubleClick) setEditing(true);
  }, [requireDoubleClick]);

  const handleInput = () => {
    if (!maxLength || !ref.current) return;
    const text = ref.current.innerText;
    if (text.length <= maxLength) return;
    ref.current.innerText = text.slice(0, maxLength);
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const handleBlur = () => {
    const v = ref.current?.innerText.trim() ?? "";
    if (v !== value) onChange(v);
    if (requireDoubleClick) setEditing(false);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === "Escape") {
      if (ref.current) ref.current.innerText = value ?? "";
      ref.current?.blur();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    setEditing(true);
    requestAnimationFrame(() => {
      ref.current?.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current!);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    });
  };

  const isEditing = !requireDoubleClick || editing;
  const classes = [
    className,
    "editable",
    !value ? "is-empty" : "",
    isEditing ? "is-editing" : "is-locked",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref}
      className={classes}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onInput={handleInput}
      onKeyDown={handleKey}
      onClick={stopPropagation ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
      onDoubleClick={requireDoubleClick ? handleDoubleClick : undefined}
      data-placeholder={placeholder}
    >
      {value}
    </Tag>
  );
}
