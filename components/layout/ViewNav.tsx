"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Network, Table2, FileText, PanelLeftOpen } from "lucide-react";
import { Topic, ProjectLink } from "@/lib/types";
import { ExportMenu } from "./ExportMenu";

export type ViewKey = "tree" | "table" | "docs";

interface Props {
  activeView: ViewKey;
  onChangeView: (v: ViewKey) => void;
  topicCount: number;
  decisionCount: number;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  projectTitle?: string;
  topics?: Topic[];
  tagline?: string;
  links?: ProjectLink[];
}

const VIEWS: { key: ViewKey; label: string; Icon: React.ElementType }[] = [
  { key: "tree", label: "Canvas", Icon: Network },
  { key: "table", label: "Table", Icon: Table2 },
  { key: "docs", label: "Docs", Icon: FileText },
];

export function ViewNav({
  activeView,
  onChangeView,
  topicCount,
  decisionCount,
  sidebarOpen,
  onToggleSidebar,
  projectTitle,
  topics = [],
  tagline,
  links,
}: Props) {
  const tabRefs = useRef<Partial<Record<ViewKey, HTMLButtonElement>>>({});
  const pillRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [barWidth, setBarWidth] = useState(Infinity);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setBarWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showStats = barWidth >= 820;
  const iconOnlyTabs = barWidth < 680;
  const showTitle = barWidth >= 460;

  useLayoutEffect(() => {
    const btn = tabRefs.current[activeView];
    const pill = pillRef.current;
    if (!btn || !pill) return;
    if (iconOnlyTabs) {
      const size = 30;
      pill.style.left = `${btn.offsetLeft + (btn.offsetWidth - size) / 2}px`;
      pill.style.width = `${size}px`;
    } else {
      pill.style.left = `${btn.offsetLeft + 8}px`;
      pill.style.width = `${btn.offsetWidth - 16}px`;
    }
  }, [activeView, iconOnlyTabs]);

  return (
    <div
      ref={rootRef}
      style={{
        height: 56,
        display: "flex",
        alignItems: "stretch",
        borderBottom: "1px solid var(--line)",
        background: "var(--paper)",
        paddingLeft: 10,
        paddingRight: 14,
        flexShrink: 0,
        gap: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 0", alignSelf: "center" }}>
        {onToggleSidebar && !sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            title="Open sidebar"
            aria-label="Open sidebar"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              color: "var(--ink-4)",
              cursor: "pointer",
              border: "none",
              background: "transparent",
              transition: "color 0.12s, background 0.12s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--ink)";
              (e.currentTarget as HTMLElement).style.background = "var(--paper-3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--ink-4)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <PanelLeftOpen size={15} />
          </button>
        )}

        <Image
          src="/mill-logo.png"
          alt="mill"
          width={70}
          height={26}
          priority
          style={{ display: "block", height: 26, width: "auto", flexShrink: 0 }}
        />

        {showStats && (
          <>
            <div style={{ width: 1, height: 18, background: "var(--line)", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--mono)",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  color: "var(--forest)",
                  background: "var(--forest-soft)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {topicCount} topics
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--mono)",
                  fontWeight: 500,
                  letterSpacing: "0.03em",
                  color: "var(--ink-3)",
                  background: "var(--paper-3)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {decisionCount} decisions
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", flex: "0 1 auto", alignSelf: "center", padding: showTitle ? "0 12px" : 0, minWidth: 0 }}>
        {showTitle && projectTitle && (
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 320,
            }}
          >
            {projectTitle}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "1 1 0",
          justifyContent: "flex-end",
          position: "relative",
          alignSelf: "center",
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "stretch", height: 30 }}>
          <span
            ref={pillRef}
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              height: 30,
              borderRadius: 8,
              background: "var(--forest-soft)",
              transition: "left 0.22s cubic-bezier(0.4, 0, 0.2, 1), width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: "none",
            }}
          />
          {VIEWS.map(({ key, label, Icon }) => {
            const active = key === activeView;
            return (
              <button
                key={key}
                ref={(el) => { tabRefs.current[key] = el ?? undefined; }}
                onClick={() => onChangeView(key)}
                title={iconOnlyTabs ? label : undefined}
                aria-label={label}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: iconOnlyTabs ? "0 11px" : "0 16px",
                  border: "none",
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--forest)" : "var(--ink-3)",
                  cursor: "pointer",
                  transition: "color 0.18s, font-weight 0s",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  zIndex: 1,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                }}
              >
                <Icon size={13} style={{ flexShrink: 0 }} />
                {!iconOnlyTabs && label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 14, background: "var(--line)", flexShrink: 0 }} />

        <ExportMenu topics={topics} projectTitle={projectTitle} tagline={tagline} links={links} />
      </div>
    </div>
  );
}
