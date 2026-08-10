"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Maximize2, ChevronsDownUp, Workflow } from "lucide-react";
import { TopicCard } from "@/components/cards/TopicCard";
import { Topic, ProjectLink } from "@/lib/types";
import {
  createLink as createLinkAction,
  deleteLink as deleteLinkAction,
} from "@/app/actions/link";

export const CARD_WIDTH = 280;
const COLLAPSED_H = 36;
const DEFAULT_H = 280;
const HANDLE_RADIUS = 6;
const HANDLE_REVEAL = 78;
const COLLAPSED_HANDLE_OUTSET = 13;

const LINK_IDLE = "var(--ink-3)";
const LINK_HOVER = "var(--ink)";

interface XY { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; }
interface Link { id: string; from: string; to: string; }

interface Props {
  topics: Topic[];
  initialLinks: ProjectLink[];
  activeId: string | null;
  highlightTag?: string | null;
  focus?: { id: string; nonce: number } | null;
  onActivate: (id: string | null) => void;
  onAddTopic: () => void;
  onDeleteTopic: (id: string) => void;
  onExpandTopic: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onCreateLink?: (outbound: string, inbound: string) => void;
  onDeleteLink?: (outbound: string, inbound: string) => void;
}

const centerOf = (r: Rect): XY => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function edgePort(r: Rect, toward: XY): XY {
  const c = centerOf(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return { x: r.x + r.w, y: c.y };
  const s = Math.min(
    Math.abs(dx) > 1e-3 ? (r.w / 2) / Math.abs(dx) : Infinity,
    Math.abs(dy) > 1e-3 ? (r.h / 2) / Math.abs(dy) : Infinity,
  );
  return { x: c.x + dx * s, y: c.y + dy * s };
}

function curveBetween(sp: XY, tp: XY): { d: string; angle: number } {
  const dx = tp.x - sp.x;
  const dy = tp.y - sp.y;
  const dist = Math.hypot(dx, dy) || 1;
  const k = Math.max(40, dist * 0.42);
  const ux = dx / dist;
  const uy = dy / dist;
  const d = `M ${sp.x} ${sp.y} C ${sp.x + ux * k} ${sp.y + uy * k} ${tp.x - ux * k} ${tp.y - uy * k} ${tp.x} ${tp.y}`;
  return { d, angle: Math.atan2(uy, ux) };
}

const ARROW_LEN = 13;

function connectionGeometry(fr: Rect, tr: Rect): { d: string; tip: XY; angle: number; mid: XY } {
  const from = centerOf(fr);
  const tip = edgePort(tr, from);
  const dx = tip.x - from.x, dy = tip.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist;
  const lineEnd = { x: tip.x - ux * (ARROW_LEN - 2), y: tip.y - uy * (ARROW_LEN - 2) };
  const { d } = curveBetween(from, lineEnd);
  const srcEdge = edgePort(fr, centerOf(tr));
  return { d, tip, angle: Math.atan2(uy, ux), mid: { x: (srcEdge.x + tip.x) / 2, y: (srcEdge.y + tip.y) / 2 } };
}

function initPositions(topics: Topic[]): Record<string, XY> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(topics.length)));
  return Object.fromEntries(
    topics.map((topic, i) => [
      topic.id,
      { x: 100 + (i % cols) * (CARD_WIDTH + 80), y: 100 + Math.floor(i / cols) * 380 },
    ])
  );
}

export function CanvasView({
  topics, initialLinks, activeId, highlightTag, focus,
  onActivate, onAddTopic, onDeleteTopic, onExpandTopic,
  onToggleCollapsed, onCreateLink, onDeleteLink,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState<XY>({ x: 60, y: 60 });
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState<Record<string, XY>>(() => initPositions(topics));
  const [links, setLinks] = useState<Link[]>(() =>
    initialLinks.map((l) => ({ id: crypto.randomUUID(), from: l.outbound, to: l.inbound }))
  );

  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [hoverPt, setHoverPt] = useState<XY | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ fromId: string; pt: XY; targetId: string | null } | null>(null);
  const [hoverLinkId, setHoverLinkId] = useState<string | null>(null);

  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  const positionsRef = useRef(positions);
  const topicsRef = useRef(topics);
  const linksRef = useRef(links);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const cardHeightsRef = useRef<Record<string, number>>({});
  const [cardWidths, setCardWidths] = useState<Record<string, number>>({});
  const cardWidthsRef = useRef<Record<string, number>>({});

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  useEffect(() => { topicsRef.current = topics; }, [topics]);
  useEffect(() => { linksRef.current = links; }, [links]);

  const isPanning = useRef(false);
  const panStart = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const draggingCard = useRef<{ id: string; cx: number; cy: number; ox: number; oy: number } | null>(null);
  const lastCardDown = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const connectFromRef = useRef<string | null>(null);

  useEffect(() => {
    setPositions((prev) => {
      const missing = topics.filter((i) => !prev[i.id]);
      if (!missing.length) return prev;
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? (rect.width / 2 - panRef.current.x) / scaleRef.current : 300;
      const cy = rect ? (rect.height / 2 - panRef.current.y) / scaleRef.current : 200;
      const extra: Record<string, XY> = {};
      missing.forEach((topic, i) => {
        extra[topic.id] = { x: cx - CARD_WIDTH / 2 + i * 24, y: cy - 80 + i * 24 };
      });
      return { ...prev, ...extra };
    });
  }, [topics]);

  useEffect(() => {
    setLinks((prev) => {
      const present = new Set(topics.map((i) => i.id));
      const next = prev.filter((l) => present.has(l.from) && present.has(l.to));
      return next.length === prev.length ? prev : next;
    });
  }, [topics]);

  const rectFor = useCallback((id: string): Rect | null => {
    const p = positions[id];
    if (!p) return null;
    const topic = topics.find((i) => i.id === id);
    const h = cardHeights[id] ?? (topic?.collapsed ? COLLAPSED_H : DEFAULT_H);
    const w = cardWidths[id] ?? CARD_WIDTH;
    return { x: p.x, y: p.y, w, h };
  }, [positions, topics, cardHeights, cardWidths]);

  const clientToWorld = useCallback((cx: number, cy: number): XY => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (cx - rect.left - panRef.current.x) / scaleRef.current,
      y: (cy - rect.top - panRef.current.y) / scaleRef.current,
    };
  }, []);

  const getCardAtWorld = useCallback((wx: number, wy: number, margin = 0): string | null => {
    let result: string | null = null;
    for (const topic of topicsRef.current) {
      const pos = positionsRef.current[topic.id];
      if (!pos) continue;
      const h = cardHeightsRef.current[topic.id] ?? (topic.collapsed ? COLLAPSED_H : DEFAULT_H);
      const w = cardWidthsRef.current[topic.id] ?? CARD_WIDTH;
      if (
        wx >= pos.x - margin && wx <= pos.x + w + margin &&
        wy >= pos.y - margin && wy <= pos.y + h + margin
      ) result = topic.id;
    }
    return result;
  }, []);

  const handleContainerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.cx;
      const dy = e.clientY - panStart.current.cy;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
      return;
    }
    if (draggingCard.current) {
      const { id, cx, cy, ox, oy } = draggingCard.current;
      const dx = (e.clientX - cx) / scaleRef.current;
      const dy = (e.clientY - cy) / scaleRef.current;
      setPositions((prev) => ({ ...prev, [id]: { x: ox + dx, y: oy + dy } }));
      return;
    }
    const wp = clientToWorld(e.clientX, e.clientY);
    if (connectFromRef.current) {
      const t = getCardAtWorld(wp.x, wp.y);
      const targetId = t && t !== connectFromRef.current ? t : null;
      setConnecting({ fromId: connectFromRef.current, pt: wp, targetId });
      return;
    }
    const card = getCardAtWorld(wp.x, wp.y, 24);
    setHoverCardId(card);
    setHoverPt(card ? wp : null);
  }, [clientToWorld, getCardAtWorld]);

  const handleContainerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.cursor = "";
    isPanning.current = false;
    const wasDraggingCard = draggingCard.current !== null;
    draggingCard.current = null;
    setDraggingId(null);
    if (wasDraggingCard) onActivate(null);

    if (connectFromRef.current) {
      const fromId = connectFromRef.current;
      const wp = clientToWorld(e.clientX, e.clientY);
      const targetId = getCardAtWorld(wp.x, wp.y);
      connectFromRef.current = null;
      setConnecting(null);
      if (
        targetId &&
        targetId !== fromId &&
        !linksRef.current.some((l) => l.from === fromId && l.to === targetId)
      ) {
        const link: Link = { id: crypto.randomUUID(), from: fromId, to: targetId };
        setLinks((prev) => [...prev, link]);
        if (onCreateLink) {
          onCreateLink(fromId, targetId);
        } else {
          createLinkAction(fromId, targetId).catch((err) => {
            console.error("Mill: link could not be saved, reverting.", err);
            setLinks((prev) => prev.filter((l) => l.id !== link.id));
          });
        }
      }
    }
  }, [clientToWorld, getCardAtWorld, onCreateLink]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && connectFromRef.current) {
        connectFromRef.current = null;
        setConnecting(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleContainerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(".cv-card-outer") || target.closest(".canvas-toolbar") || target.closest(".cv-svg-interactive")) return;
    setHoverCardId(null);
    isPanning.current = true;
    panStart.current = { cx: e.clientX, cy: e.clientY, px: panRef.current.x, py: panRef.current.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    e.currentTarget.style.cursor = "grabbing";
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const newScale = Math.max(0.15, Math.min(3, scaleRef.current * factor));
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - panRef.current.x) / scaleRef.current;
    const wy = (my - panRef.current.y) / scaleRef.current;
    setPan({ x: mx - wx * newScale, y: my - wy * newScale });
    setScale(newScale);
  }, []);

  const handleCardDragStart = useCallback((id: string, e: React.PointerEvent) => {
    if (lastCardDown.current.id === id && e.timeStamp - lastCardDown.current.t < 350) {
      lastCardDown.current = { id: "", t: 0 };
      onExpandTopic(id);
      return;
    }
    lastCardDown.current = { id, t: e.timeStamp };
    const pos = positionsRef.current[id] ?? { x: 0, y: 0 };
    draggingCard.current = { id, cx: e.clientX, cy: e.clientY, ox: pos.x, oy: pos.y };
    setDraggingId(id);
    onActivate(id);
    setHoverCardId(null);
    try { containerRef.current?.setPointerCapture(e.pointerId); } catch {}
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }, [onActivate, onExpandTopic]);

  const startConnect = useCallback((e: React.PointerEvent<SVGElement>, fromId: string) => {
    e.stopPropagation();
    const wp = clientToWorld(e.clientX, e.clientY);
    connectFromRef.current = fromId;
    setConnecting({ fromId, pt: wp, targetId: null });
    setHoverCardId(null);
    try { containerRef.current?.setPointerCapture(e.pointerId); } catch {}
  }, [clientToWorld]);

  const removeLink = useCallback((id: string) => {
    const link = linksRef.current.find((l) => l.id === id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setHoverLinkId(null);
    if (link) {
      if (onDeleteLink) {
        onDeleteLink(link.from, link.to);
      } else {
        deleteLinkAction(link.from, link.to).catch((err) => {
          console.error("Mill: link could not be deleted, reverting.", err);
          setLinks((prev) => [...prev, link]);
        });
      }
    }
  }, [onDeleteLink]);

  const handleCenter = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    const active = Object.entries(positionsRef.current).filter(([id]) => topicsRef.current.some((i) => i.id === id));
    if (!active.length) return;
    const xs = active.map(([, p]) => p.x);
    const ys = active.map(([, p]) => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs) + CARD_WIDTH;
    const minY = Math.min(...ys); const maxY = Math.max(...ys) + 340;
    const pad = 80;
    const newScale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY), 1);
    setScale(newScale);
    setPan({ x: width / 2 - ((minX + maxX) / 2) * newScale, y: height / 2 - ((minY + maxY) / 2) * newScale });
  }, []);

  const focusTopicId = useCallback((id: string) => {
    const container = containerRef.current;
    const pos = positionsRef.current[id];
    if (!container || !pos) return;
    const { width, height } = container.getBoundingClientRect();
    const s = Math.max(scaleRef.current, 0.6);
    const w = cardWidthsRef.current[id] ?? CARD_WIDTH;
    const h = cardHeightsRef.current[id] ?? DEFAULT_H;
    const cx = pos.x + w / 2;
    const cy = pos.y + h / 2;
    const target = { x: width / 2 - cx * s, y: height / 2 - cy * s };
    const start = { ...panRef.current };
    const startScale = scaleRef.current;
    const t0 = performance.now();
    const dur = 340;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      setPan({ x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e });
      if (s !== startScale) setScale(startScale + (s - startScale) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (!focus) return;
    focusTopicId(focus.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const handleCollapseAll = useCallback(() => {
    const allCollapsed = topicsRef.current.every((topic) => topic.collapsed);
    topicsRef.current.forEach((topic) => {
      if (allCollapsed ? topic.collapsed : !topic.collapsed) onToggleCollapsed(topic.id);
    });
  }, [onToggleCollapsed]);

  const handleAutoAlign = useCallback(() => {
    const currentLinks = linksRef.current;
    const currentTopics = topicsRef.current;
    if (currentLinks.length === 0) return;

    const linkedIds = new Set<string>();
    for (const link of currentLinks) {
      linkedIds.add(link.from);
      linkedIds.add(link.to);
    }

    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    for (const id of linkedIds) { adj[id] = []; inDegree[id] = 0; }
    for (const link of currentLinks) {
      adj[link.from].push(link.to);
      inDegree[link.to] = (inDegree[link.to] ?? 0) + 1;
    }

    const levels: Record<string, number> = {};
    for (const id of linkedIds) levels[id] = 0;
    for (let pass = 0; pass < linkedIds.size; pass++) {
      let changed = false;
      for (const link of currentLinks) {
        const next = (levels[link.from] ?? 0) + 1;
        if (next > (levels[link.to] ?? 0)) { levels[link.to] = next; changed = true; }
      }
      if (!changed) break;
    }

    const byLevel: Record<number, string[]> = {};
    for (const [id, lv] of Object.entries(levels)) {
      (byLevel[lv] = byLevel[lv] ?? []).push(id);
    }

    const GAP_X = 80;
    const GAP_Y = 40;
    const heightOf = (id: string) => {
      const topic = currentTopics.find((x) => x.id === id);
      return topic?.collapsed ? COLLAPSED_H : (cardHeightsRef.current[id] ?? DEFAULT_H);
    };
    const colX = (lv: number) => 80 + lv * (CARD_WIDTH + GAP_X);

    setPositions((prev) => {
      const next = { ...prev };
      let maxLevel = 0;
      for (const [lvStr, nodes] of Object.entries(byLevel)) {
        const lv = Number(lvStr);
        maxLevel = Math.max(maxLevel, lv);
        let y = 80;
        for (const id of nodes) {
          next[id] = { x: colX(lv), y };
          y += heightOf(id) + GAP_Y;
        }
      }
      const unlinked = currentTopics.filter((i) => !linkedIds.has(i.id));
      if (unlinked.length) {
        const lv = maxLevel + 1;
        let y = 80;
        for (const topic of unlinked) {
          next[topic.id] = { x: colX(lv), y };
          y += heightOf(topic.id) + GAP_Y;
        }
      }
      return next;
    });
  }, []);

  const handleAddCard = useCallback(() => {
    onAddTopic();
  }, [onAddTopic]);

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
      onWheel={handleWheel}
    >
      <svg
        className="canvas-svg"
        overflow="visible"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {links.map((link) => {
            const fr = rectFor(link.from);
            const tr = rectFor(link.to);
            if (!fr || !tr) return null;
            const { d, tip, angle, mid } = connectionGeometry(fr, tr);
            const hovered = hoverLinkId === link.id;
            const color = hovered ? LINK_HOVER : LINK_IDLE;
            return (
              <g key={link.id}>
                <path
                  className="cv-svg-interactive"
                  d={d} stroke="transparent" strokeWidth={26} fill="none"
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoverLinkId(link.id)}
                  onMouseLeave={() => setHoverLinkId(null)}
                  onContextMenu={(e) => { e.preventDefault(); removeLink(link.id); }}
                />
                <path
                  d={d} stroke={color} strokeWidth={hovered ? 2.5 : 2}
                  strokeLinecap="round" fill="none"
                  style={{ transition: "stroke-width 0.12s" }}
                />
                <g transform={`translate(${tip.x} ${tip.y}) rotate(${(angle * 180) / Math.PI})`}>
                  <path d="M 0 0 L -13 -6.5 L -13 6.5 Z" fill={color} />
                </g>
                {hovered && (
                  <g
                    className="cv-svg-interactive cv-link-delete"
                    style={{ pointerEvents: "all", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); removeLink(link.id); }}
                    onMouseEnter={() => setHoverLinkId(link.id)}
                  >
                    <circle cx={mid.x} cy={mid.y} r={10} fill="var(--paper)" stroke={LINK_HOVER} strokeWidth={1.5} />
                    <line x1={mid.x - 3.5} y1={mid.y - 3.5} x2={mid.x + 3.5} y2={mid.y + 3.5} stroke={LINK_HOVER} strokeWidth={1.5} />
                    <line x1={mid.x + 3.5} y1={mid.y - 3.5} x2={mid.x - 3.5} y2={mid.y + 3.5} stroke={LINK_HOVER} strokeWidth={1.5} />
                  </g>
                )}
              </g>
            );
          })}

          {connecting && (() => {
            const fr = rectFor(connecting.fromId);
            if (!fr) return null;
            const target = connecting.targetId ? rectFor(connecting.targetId) : null;
            const color = LINK_IDLE;
            if (target) {
              const { d, tip, angle } = connectionGeometry(fr, target);
              return (
                <g>
                  <rect
                    x={target.x - 3} y={target.y - 3}
                    width={target.w + 6} height={target.h + 6}
                    rx={13} fill="none" stroke={color} strokeWidth={2} opacity={0.6}
                  />
                  <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
                  <g transform={`translate(${tip.x} ${tip.y}) rotate(${(angle * 180) / Math.PI})`}>
                    <path d="M 0 0 L -13 -6.5 L -13 6.5 Z" fill={color} />
                  </g>
                </g>
              );
            }
            const { d } = curveBetween(centerOf(fr), connecting.pt);
            return (
              <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="6 5" opacity={0.9} />
            );
          })()}
        </g>
      </svg>

      <div
        className="canvas-world"
        style={{ position: "absolute", left: 0, top: 0, zIndex: 2, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
      >
        {topics.map((topic, i) => {
          const pos = positions[topic.id] ?? { x: 100 + i * (CARD_WIDTH + 80), y: 100 };
          return (
            <div
              key={topic.id}
              className="cv-card-wrap"
              ref={(el) => {
                if (!el) return;
                const h = el.offsetHeight;
                const w = el.offsetWidth;
                cardHeightsRef.current[topic.id] = h;
                cardWidthsRef.current[topic.id] = w;
                setCardHeights((prev) => (prev[topic.id] === h ? prev : { ...prev, [topic.id]: h }));
                setCardWidths((prev) => (prev[topic.id] === w ? prev : { ...prev, [topic.id]: w }));
              }}
              style={{ left: pos.x, top: pos.y, zIndex: topic.id === draggingId ? 10 : undefined }}
            >
              <TopicCard
                topic={topic}
                index={i}
                active={topic.id === activeId}
                tagMatch={!!highlightTag && (topic.tags ?? []).includes(highlightTag)}
                dragging={topic.id === draggingId}
                canvasMode={true}
                onActivate={() => onActivate(topic.id)}
                onDelete={() => onDeleteTopic(topic.id)}
                onExpand={() => onExpandTopic(topic.id)}
                onToggleCollapsed={() => onToggleCollapsed(topic.id)}
                onDragStart={(e) => handleCardDragStart(topic.id, e)}
              />
            </div>
          );
        })}
      </div>

      <svg
        className="canvas-svg"
        overflow="visible"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", zIndex: 3, pointerEvents: "none" }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {hoverCardId && !connecting && (() => {
            const r = rectFor(hoverCardId);
            if (!r) return null;
            const color = LINK_IDLE;
            const o = topics.find((t) => t.id === hoverCardId)?.collapsed ? COLLAPSED_HANDLE_OUTSET : 0;
            const handles: XY[] = [
              { x: r.x + r.w / 2, y: r.y - o },
              { x: r.x + r.w + o, y: r.y + r.h / 2 },
              { x: r.x + r.w / 2, y: r.y + r.h + o },
              { x: r.x - o, y: r.y + r.h / 2 },
            ];
            return (
              <g className="cv-svg-interactive">
                {handles.map((p, i) => {
                  const near = hoverPt ? Math.max(0, 1 - Math.hypot(hoverPt.x - p.x, hoverPt.y - p.y) / HANDLE_REVEAL) : 0;
                  if (near <= 0) return null;
                  const r = HANDLE_RADIUS + near * 5;
                  return (
                    <g
                      key={i}
                      style={{ cursor: "crosshair" }}
                      onPointerDown={(e) => startConnect(e, hoverCardId)}
                    >
                      <circle cx={p.x} cy={p.y} r={r + 12} fill="transparent" style={{ pointerEvents: "all" }} />
                      <circle
                        cx={p.x} cy={p.y} r={r}
                        fill="var(--paper)" stroke={color} strokeWidth={2}
                        opacity={near}
                        style={{ pointerEvents: "all" }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </g>
      </svg>

      <div className="canvas-toolbar">
        <button className="canvas-button-small" onClick={handleCollapseAll} title="Collapse all">
          <ChevronsDownUp size={14} />
        </button>
        <button className="canvas-button-small" onClick={handleAutoAlign} title="Auto-layout flow (A→B→C)">
          <Workflow size={14} />
        </button>
        <button className="canvas-button-small" onClick={handleCenter} title="Center view">
          <Maximize2 size={14} />
        </button>
        <button className="canvas-button-large" onClick={handleAddCard} title="Add card">
          <Plus size={22} />
        </button>
      </div>
    </div>
  );
}
