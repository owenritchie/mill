"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { TONES } from "@/lib/types";

const K = ({ children }: { children: React.ReactNode }) => <span style={{ color: "var(--ink)" }}>{children}</span>;
const P = ({ children }: { children: React.ReactNode }) => <span style={{ color: "var(--ink-4)" }}>{children}</span>;

const literal: React.CSSProperties = {
  fontVariantLigatures: "none",
  fontFeatureSettings: '"calt" 0, "liga" 0, "dlig" 0',
};

const Sx = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.4, color: "var(--ink)", whiteSpace: "nowrap", ...literal }}>
    {children}
  </span>
);
const Hint = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.4, color: "var(--ink-3)", ...literal }}>{children}</span>
);
const Eyebrow = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div
    style={{
      gridColumn: "1 / -1",
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      fontWeight: 500,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "var(--ink-4)",
      margin: first ? "0 0 1px" : "13px 0 1px",
    }}
  >
    {children}
  </div>
);

export function DocSyntaxHelp() {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Doc syntax"
        aria-label="Doc syntax"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          padding: 5,
          cursor: "pointer",
          background: open ? "var(--paper-3)" : "transparent",
          color: open ? "var(--ink-2)" : "var(--ink-3)",
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => {
          if (open) return;
          e.currentTarget.style.background = "var(--paper-3)";
          e.currentTarget.style.color = "var(--ink-2)";
        }}
        onMouseLeave={(e) => {
          if (open) return;
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-3)";
        }}
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Doc syntax"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 200,
            width: 344,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(560px, calc(100vh - 120px))",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--paper)",
            border: "1px solid var(--line-strong)",
            borderRadius: 12,
            boxShadow: "0 6px 20px rgba(29,26,22,0.12)",
            animation: "popIn 0.13s ease",
            color: "var(--ink)",
            padding: "6px 0",
          }}
        >
          <div
            className="doc-syntax-scroll"
            style={{
              overflowY: "auto",
              overscrollBehavior: "contain",
              scrollbarGutter: "stable",
              padding: "8px 16px",
              minHeight: 0,
            }}
          >
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Doc syntax</div>
          <div style={{ height: 1, background: "var(--line)", margin: "11px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 18, rowGap: 8, alignItems: "baseline" }}>
            <Eyebrow first>Structure</Eyebrow>
            <Sx><K>#</K> <P>Project Title</P></Sx><Hint>The document title</Hint>
            <Sx><K>&gt;</K> <P>Tagline</P></Sx><Hint>Sits under the title</Hint>
            <Sx><K>##</K> <P>Topic Title</P></Sx><Hint>New card, number optional</Hint>

            <Eyebrow>Topic</Eyebrow>
            <Sx><K>@tone</K> <P>color</P></Sx><Hint>{TONES.join(", ")}</Hint>
            <Sx><K>@priority</K> <P>P1</P></Sx><Hint>P1 to P4, high to low</Hint>
            <Sx><K>@tags</K> <P>a, b</P></Sx><Hint>Comma-separated</Hint>
            <Sx><K>@timeline</K></Sx><Hint>start -&gt; end, dates as YYYY-MM-DD</Hint>
            <Sx><K>@issue</K> <P>url</P></Sx><Hint>Links a URL</Hint>

            <Eyebrow>Summary &amp; decisions</Eyebrow>
            <Sx><P>Summary text</P></Sx><Hint>Plain text under a topic</Hint>
            <Sx><K>-</K> <P>Decision</P></Sx><Hint>A decision</Hint>
            <Sx><K>-</K> <P>Decision</P> <K>—</K> <P>Note</P></Sx><Hint>Note is optional</Hint>

            <Eyebrow>Linkages</Eyebrow>
            <Sx><K>## Linkages</K></Sx><Hint>Starts the links list</Hint>
            <Sx><K>-</K> <P>1</P> <K>-&gt;</K> <P>2</P></Sx><Hint>Link topics by number</Hint>
          </div>

          <div style={{ height: 1, background: "var(--line)", margin: "11px 0" }} />
          <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-4)" }}>
            Blank lines and <span style={{ fontFamily: "var(--mono)", color: "var(--ink-3)" }}>###</span> headings are
            ignored, so space things out however you like. Edits save on their own.
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
