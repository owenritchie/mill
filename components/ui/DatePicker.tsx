"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS, MONTHS_SHORT } from "@/lib/types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const formatDisplay = (s: string) => {
  const d = parseISO(s);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  toneColor: string;
  min?: string;
  max?: string;
  placeholder?: string;
}

const CAL_W = 252;
const CAL_H = 340;
const GAP = 6;

export function DatePicker({ label, value, onChange, toneColor, min, max, placeholder = "Set date" }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState(() => {
    const base = value ? parseISO(value) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const openCal = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    let left = r.right - CAL_W;
    if (left + CAL_W > window.innerWidth - 8) left = window.innerWidth - 8 - CAL_W;
    if (left < 8) left = 8;
    let top = r.bottom + GAP;
    if (top + CAL_H > window.innerHeight - 8) {
      const above = r.top - CAL_H - GAP;
      top = above > 8 ? above : Math.max(8, window.innerHeight - CAL_H - 8);
    }
    const base = value ? parseISO(value) : min ? parseISO(min) : new Date();
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setPos({ left, top });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (calRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  const pick = (iso: string) => { onChange(iso); setOpen(false); };

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const prevDays = new Date(view.y, view.m, 0).getDate();
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({ iso: toISO(new Date(view.y, view.m - 1, day)), day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toISO(new Date(view.y, view.m, day)), day, inMonth: true });
  }
  for (let day = 1; cells.length < 42; day++) {
    cells.push({ iso: toISO(new Date(view.y, view.m + 1, day)), day, inMonth: false });
  }

  const todayISO = toISO(new Date());
  const disabled = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ip-date-trigger${open ? " is-open" : ""}${value ? " has-value" : ""}`}
        onClick={() => (open ? setOpen(false) : openCal())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `${label} date: ${formatDisplay(value)}` : `Set ${label.toLowerCase()} date`}
      >
        <Calendar size={18} className="ip-date-trigger-icon" aria-hidden />
        <span className="ip-date-trigger-body">
          <span className="ip-date-trigger-label">{label}</span>
          <span className="ip-date-trigger-value">{value ? formatDisplay(value) : placeholder}</span>
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={calRef}
          className="ip-cal"
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()} date`}
          style={{ left: pos.left, top: pos.top, ["--cal-tone" as string]: toneColor }}
        >
          <div className="ip-cal-head">
            <span className="ip-cal-title">{MONTHS[view.m]} {view.y}</span>
            <div className="ip-cal-nav">
              <button type="button" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={15} /></button>
              <button type="button" onClick={nextMonth} aria-label="Next month"><ChevronRight size={15} /></button>
            </div>
          </div>
          <div className="ip-cal-weekdays" aria-hidden>
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="ip-cal-grid">
            {cells.map((c, i) => {
              const isDisabled = disabled(c.iso);
              const selected = value === c.iso;
              const isToday = todayISO === c.iso;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(c.iso)}
                  aria-current={selected ? "date" : undefined}
                  className={[
                    "ip-cal-day",
                    c.inMonth ? "" : "is-outside",
                    selected ? "is-selected" : "",
                    isToday && !selected ? "is-today" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="ip-cal-foot">
            <button type="button" className="ip-cal-action" onClick={() => pick("")}>Clear</button>
            <button
              type="button"
              className="ip-cal-action"
              disabled={disabled(todayISO)}
              onClick={() => pick(todayISO)}
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
