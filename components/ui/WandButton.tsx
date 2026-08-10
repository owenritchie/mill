"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  onClick?: () => void;
  tabIndex?: number;
  title?: string;
  loading?: boolean;
}

export function WandButton({ onClick, tabIndex, title = "Enhance with AI", loading = false }: Props) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={loading ? undefined : onClick}
      disabled={loading}
      tabIndex={tabIndex}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid transparent",
        background: hovered && !loading ? "color-mix(in srgb, var(--tone) 10%, var(--paper))" : "transparent",
        color: "var(--tone)",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.7 : 1,
        transition: "background 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease-out",
      }}
    >
      {loading ? (
        <Spinner size={11} />
      ) : (
        <Wand2
          size={11}
          strokeWidth={2}
          style={{
            transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
            transform: hovered ? "rotate(-12deg)" : "rotate(0deg)",
          }}
        />
      )}
    </button>
  );
}
