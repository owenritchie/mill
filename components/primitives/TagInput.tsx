"use client";

import { useRef, useState, useEffect } from "react";
import { TOPIC_LIMITS } from "@/lib/types";

interface Props {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  onCreateTag: (tag: string) => void;
  maxTags?: number;
}

export function TagInput({ tags, allTags, onChange, onCreateTag, maxTags = TOPIC_LIMITS.tags }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const openPop = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setPopPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };

  const atLimit = tags.length >= maxTags;
  const filtered = allTags.filter(
    (t) => t.toLowerCase().includes(query.toLowerCase()) && !tags.includes(t)
  );
  const canCreate = !atLimit && !!query.trim() && !allTags.includes(query.trim()) && !tags.includes(query.trim());

  const addTag = (tag: string) => {
    if (tags.length >= maxTags) return;
    onChange([...tags, tag]);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="tag-input-wrap" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="tag-input"
        value={query}
        maxLength={TOPIC_LIMITS.tagLength}
        disabled={atLimit}
        onChange={(e) => { setQuery(e.target.value); openPop(); }}
        onFocus={openPop}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && query.trim()) {
            e.preventDefault();
            if (canCreate) { onCreateTag(query.trim()); addTag(query.trim()); }
            else if (filtered.length > 0) addTag(filtered[0]);
          }
          if (e.key === "Backspace" && !query && tags.length > 0) onChange(tags.slice(0, -1));
          if (e.key === "Escape") { setOpen(false); setQuery(""); inputRef.current?.blur(); }
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder={atLimit ? `max ${maxTags}` : tags.length === 0 ? "#tag" : "+"}
        title={atLimit ? `Up to ${maxTags} tags` : undefined}
      />
      {open && !atLimit && (filtered.length > 0 || canCreate) && popPos && (
        <div
          className="tags-pop"
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 500 }}
        >
          {filtered.slice(0, 8).map((t) => (
            <button
              key={t}
              className="tags-option"
              onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
            >
              <span className="tag-hash">#</span>{t}
            </button>
          ))}
          {canCreate && (
            <button
              className="tags-option tags-create"
              onMouseDown={(e) => {
                e.preventDefault();
                onCreateTag(query.trim());
                addTag(query.trim());
              }}
            >
              Create <span className="tag-hash">#</span>{query.trim()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
