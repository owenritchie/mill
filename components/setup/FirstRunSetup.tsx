"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Loader2 } from "lucide-react";
import { setLocalStorageLocation } from "@/app/actions/storage";

const ROSE = "var(--rose)";

const CSS = `
@keyframes millSpin { to { transform: rotate(360deg) } }

.mill-start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 36px;
  border: none;
  border-radius: 999px;
  background: #1A471C;
  color: #FFFDF6;
  font-family: var(--sans);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.005em;
  line-height: 1;
  cursor: pointer;
  font-variant-ligatures: none;
  font-feature-settings: "calt" 0, "liga" 0, "dlig" 0;
  transition:
    background 0.085s cubic-bezier(0.2, 0, 0, 1),
    transform 0.085s cubic-bezier(0.2, 0, 0, 1);
}
.mill-start:hover:not([disabled]) {
  background: #226023;
  transform: translateY(-1px);
}
.mill-start:active:not([disabled]) {
  background: #143C16;
  transform: translateY(1px);
  transition-duration: 0.04s;
}
.mill-start:focus-visible {
  outline: 2px solid #1A471C;
  outline-offset: 3px;
}
.mill-start[disabled] { cursor: default; background: #3A6B3B }

.mill-start .mill-chev {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: oklch(100% 0 0 / 0.6);
  font-variant-ligatures: none;
  font-feature-settings: "calt" 0, "liga" 0, "dlig" 0;
}

@media (prefers-reduced-motion: reduce) {
  .mill-start:hover:not([disabled]),
  .mill-start:active:not([disabled]) { transform: none }
}
`;

export function FirstRunSetup() {
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const createLocal = async () => {
    setCreating(true);
    setErr(null);
    const res = await setLocalStorageLocation();
    if (res.ok) {
      window.location.reload();
      return;
    }
    setErr(res.error ?? "Could not create the local database.");
    setCreating(false);
  };

  return (
    <div style={screenStyle}>
      <style>{CSS}</style>

      <div style={leftStyle}>
        <Image
          src="/mill-logo.png"
          alt="Mill"
          width={1926}
          height={712}
          priority
          style={logoStyle}
        />
      </div>

      <div style={stackStyle}>
        <h1 style={headingStyle}>Let&rsquo;s set up your environment!</h1>
        <p style={subtextStyle}>
          Your information lives locally on this computer, private to you.
        </p>

        <button className="mill-start" disabled={creating} onClick={createLocal}>
          {creating ? (
            <>
              <Loader2 size={17} style={spin} />
              <span>Creating your workspace</span>
            </>
          ) : (
            <>
              <span>Start Planning</span>
              <span className="mill-chev" aria-hidden>
                &gt;&gt;
              </span>
            </>
          )}
        </button>

        {err && (
          <div style={resultRow}>
            <AlertTriangle size={14} />
            <span>{err}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const GUTTER = "clamp(28px, 6vw, 96px)";

const SPLIT = "clamp(26px, 4vw, 64px)";

const screenStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  alignItems: "center",
  padding: `48px ${GUTTER}`,
  background: "var(--paper)",
};

const leftStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  paddingRight: SPLIT,
};

const COLUMN = "min(100%, clamp(300px, 32vw, 440px))";

const logoStyle: React.CSSProperties = {
  width: COLUMN,
  height: "auto",
  objectFit: "contain",
};

const stackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  textAlign: "left",
  borderLeft: "1px solid var(--line-strong)",
  paddingLeft: SPLIT,
  width: COLUMN,
  boxSizing: "content-box",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: "clamp(32px, 3.6vw, 52px)",
  fontWeight: 400,
  color: "var(--ink)",
  letterSpacing: "-0.03em",
  lineHeight: 1.02,
  margin: "0 0 16px",
};

const subtextStyle: React.CSSProperties = {
  fontSize: "clamp(15px, 1.5vw, 18px)",
  lineHeight: 1.55,
  color: "var(--ink-3)",
  margin: "0 0 30px",
};

const spin: React.CSSProperties = { animation: "millSpin 0.7s linear infinite" };

const resultRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  fontSize: 12.5,
  lineHeight: 1.45,
  color: ROSE,
  background: "#fbeded",
  border: "1px solid #f3c9c9",
  borderRadius: 9,
  padding: "9px 12px",
  marginTop: 20,
  textAlign: "left",
};
