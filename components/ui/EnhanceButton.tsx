"use client";

import { useState, useRef, useEffect } from "react";
import { Wand2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

const FULL_TEXT = "Enhance";
const BUSY_TEXT = "Thinking";
const ENTRY_DELAY = 40;
const TYPE_INTERVAL = 22;

interface Props {
  onClick?: () => void;
  style?: React.CSSProperties;
  loading?: boolean;
  disabled?: boolean;
}

export function EnhanceButton({ onClick, style, loading = false, disabled = false }: Props) {
  const inactive = loading || disabled;
  const [hovered, setHovered] = useState(false);
  const [displayText, setDisplayText] = useState(FULL_TEXT);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRef = useRef(false);

  const handleMouseEnter = () => {
    if (inactive) return;
    hoveredRef.current = true;
    setHovered(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!hoveredRef.current) return;
      setDisplayText("");
      let i = 0;
      const type = () => {
        if (!hoveredRef.current) { setDisplayText(FULL_TEXT); return; }
        i++;
        setDisplayText(FULL_TEXT.slice(0, i));
        if (i < FULL_TEXT.length) timerRef.current = setTimeout(type, TYPE_INTERVAL);
      };
      timerRef.current = setTimeout(type, TYPE_INTERVAL);
    }, ENTRY_DELAY);
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
    setHovered(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setDisplayText(FULL_TEXT);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const label = loading ? BUSY_TEXT : FULL_TEXT;

  return (
    <button
      onClick={inactive ? undefined : onClick}
      disabled={inactive}
      title={loading ? "Asking the AI to enhance this topic…" : "Enhance decisions with AI"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 13px",
        borderRadius: 7,
        border: hovered && !inactive ? "1px solid var(--forest)" : "1px solid var(--line)",
        background: hovered && !inactive ? "var(--forest)" : "transparent",
        color: hovered && !inactive ? "oklch(97% 0.02 140)" : "var(--ink-4)",
        fontSize: 12,
        fontFamily: "var(--sans)",
        cursor: inactive ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition: "background 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out, opacity 0.15s ease-out",
        ...style,
      }}
    >
      {loading ? (
        <Spinner size={11} />
      ) : (
        <Wand2
          size={11}
          style={{
            flexShrink: 0,
            transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
            transform: hovered ? "rotate(-12deg)" : "rotate(0deg)",
          }}
        />
      )}
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ visibility: "hidden" }}>{label}</span>
        <span style={{ position: "absolute", left: 0, top: 0 }}>
          {loading ? BUSY_TEXT : displayText}
        </span>
      </span>
    </button>
  );
}
