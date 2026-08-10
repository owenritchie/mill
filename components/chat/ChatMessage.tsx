import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage as ChatMessageType } from "@/lib/types";
import { ActionPlan } from "./ActionPlan";
import { CHAT } from "./chrome";

interface Props {
  message: ChatMessageType;
  onApply?: () => void;
  onDismiss?: () => void;
  applying?: boolean;
}

export function ChatMessage({ message, onApply, onDismiss, applying }: Props) {
  const hasActions = !!message.actions?.length;

  if (message.stopped) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: CHAT.space.sm,
          fontFamily: "var(--mono)",
          fontSize: CHAT.fs.meta,
          color: "var(--ink-4)",
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--ink-4)" }} />
        Stopped, the reply was discarded.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: message.role === "user" ? "flex-end" : "flex-start",
      }}
    >
      <div className={message.role === "user" ? "chat-msg-user" : "chat-msg-ai"}>
        {message.role === "user" ? (
          message.text
        ) : (
          <div className="chat-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
      {hasActions && (
        <ActionPlan
          actions={message.actions!}
          state={message.actionState ?? "proposed"}
          applying={applying}
          onApply={() => onApply?.()}
          onDismiss={() => onDismiss?.()}
        />
      )}
      {message.role === "assistant" && message.noBuildActions && !hasActions && (
        <div
          style={{
            marginTop: CHAT.space.sm,
            fontSize: CHAT.fs.meta,
            fontFamily: "var(--mono)",
            color: "var(--ink-4)",
          }}
        >
          No changes proposed, nothing to apply.
        </div>
      )}
    </div>
  );
}
