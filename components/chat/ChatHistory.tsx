"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { CHAT, CHAT_CHROME_CSS } from "./chrome";
import { ChatMessage as ChatMessageType } from "@/lib/types";

interface Props {
  messages: ChatMessageType[];
  pending?: boolean;
  error?: string | null;
  applyingId?: string | null;
  onApplyActions?: (messageId: string) => void;
  onDismissActions?: (messageId: string) => void;
}

export function ChatHistory({
  messages,
  pending = false,
  error = null,
  applyingId = null,
  onApplyActions,
  onDismissActions,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, error]);

  return (
    <div
      className="chat-scroll"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: `${CHAT.space.lg}px ${CHAT.space.lg}px ${CHAT.space.sm}px`,
        display: "flex",
        flexDirection: "column",
        gap: CHAT.space.xl,
      }}
    >
      <style>{`
        @keyframes millSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes millThink {
          0%, 70%, 100% { opacity: 0.22; transform: scale(0.76) }
          35%           { opacity: 1;    transform: scale(1) }
        }
        @media (prefers-reduced-motion: reduce) {
          .mill-think-dot { animation: none !important; opacity: 0.5 }
        }
        ${CHAT_CHROME_CSS}
        .chat-md > :first-child { margin-top: 0 }
        .chat-md > :last-child { margin-bottom: 0 }
        .chat-md p { margin: 0 0 12px }
        .chat-md ul { list-style: disc; margin: 10px 0 12px; padding-left: 20px }
        .chat-md ol { list-style: decimal; margin: 10px 0 12px; padding-left: 22px }
        .chat-md li { margin: 5px 0 }
        .chat-md li::marker { color: var(--ink-4) }
        .chat-md li > p { margin: 0 }
        .chat-md strong { font-weight: 600; color: var(--ink) }
        .chat-md em { font-style: italic }
        .chat-md a { color: var(--forest); text-decoration: underline }
        .chat-md h1, .chat-md h2, .chat-md h3, .chat-md h4 {
          font-size: ${CHAT.fs.body}px; font-weight: 600; color: var(--ink);
          line-height: 1.35; margin: 18px 0 6px;
        }
        .chat-md code {
          font-family: var(--mono); font-size: 0.84em;
          background: color-mix(in srgb, var(--forest) 10%, var(--paper));
          border: 1px solid color-mix(in srgb, var(--forest) 14%, var(--line));
          padding: 1px 5px; border-radius: 5px;
          overflow-wrap: anywhere;
        }
        .chat-md pre {
          background: color-mix(in srgb, var(--forest) 8%, var(--paper));
          border: 1px solid color-mix(in srgb, var(--forest) 12%, var(--line));
          border-radius: 8px; padding: 8px 10px; margin: 6px 0 8px;
          max-width: 100%; overflow-x: auto;
        }
        .chat-md pre code { background: none; border: none; padding: 0; white-space: pre; }
        .chat-md blockquote {
          margin: 6px 0; padding-left: 10px; color: var(--ink-2);
          border-left: 2px solid color-mix(in srgb, var(--forest) 30%, var(--line));
        }
        .chat-md hr { border: none; border-top: 1px solid var(--line); margin: 16px 0 }
        .chat-md table {
          border-collapse: collapse; margin: 10px 0; font-size: ${CHAT.fs.ui}px;
          display: block; overflow-x: auto; max-width: 100%;
        }
        .chat-md th, .chat-md td { border: 1px solid var(--line); padding: 5px 8px; text-align: left }
      `}</style>
      {messages.map((m) => (
        <ChatMessage
          key={m.id}
          message={m}
          applying={applyingId === m.id}
          onApply={() => onApplyActions?.(m.id)}
          onDismiss={() => onDismissActions?.(m.id)}
        />
      ))}
      {pending && <ThinkingRow />}
      {error && <ErrorRow text={error} />}
      <div ref={bottomRef} />
    </div>
  );
}

function ThinkingRow() {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 5, height: 20 }}
      role="status"
      aria-live="polite"
      aria-label="Assistant is thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="mill-think-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--forest)",
            animation: `millThink 1.2s ${i * 0.16}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
          }}
        />
      ))}
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: CHAT.space.sm,
        background: "color-mix(in srgb, var(--rose) 8%, var(--paper))",
        color: "#a02e2e",
        borderRadius: CHAT.radius.md,
        padding: `${CHAT.space.sm + 2}px ${CHAT.space.md}px`,
        fontSize: CHAT.fs.ui,
        lineHeight: 1.5,
      }}
    >
      <AlertTriangle size={CHAT.icon.meta} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{text}</span>
    </div>
  );
}
