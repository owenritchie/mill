"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBar } from "./ChatBar";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";
import { NoWorkspaceNotice } from "./NoWorkspaceNotice";
import { QuickActions } from "./QuickActions";
import { addUsage, ChatMessage } from "@/lib/types";
import type {
  AppSettings,
  ChatHook,
  ChatMode,
  ChatSummary,
  OllamaModel,
  AiSettingsInput,
  Space,
  TokenUsage,
} from "@/lib/types";
import { CLAUDE_MODEL_ALIASES } from "@/lib/types";
import { sendChatMessage, applyChatActions, type ChatTurn } from "@/app/actions/chat";
import {
  deleteChat as deleteChatAction,
  listChats,
  loadChat,
  saveChat,
} from "@/app/actions/chat-history";
import {
  listOllamaModels,
  loadChatHooks,
  resolveClaudeModelVersions,
  saveEnabledHooks,
} from "@/app/actions/config";

const greeting = (): ChatMessage => ({
  id: crypto.randomUUID(),
  role: "assistant",
  text: "Hi. What are you working on?",
  createdAt: new Date(),
});

interface Props {
  settings: AppSettings;
  onApplyAiSettings: (next: AiSettingsInput) => Promise<void>;
  onLearnClaudeVersions: (map: Record<string, string>) => void;
  activeProjectId: string | null;
  activeSpaceId: string | null;
  onApplied: (spaces: Space[]) => void;
  contextIds: string[];
  hasWorkspace: boolean;
  onCreateProject: () => void;
  onOpenSettings: () => void;
  hooksVersion: number;
}

export function ChatPanel({
  settings,
  onApplyAiSettings,
  onLearnClaudeVersions,
  activeProjectId,
  activeSpaceId,
  onApplied,
  contextIds,
  hasWorkspace,
  onCreateProject,
  onOpenSettings,
  hooksVersion,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("plan");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const provider = settings.aiProvider;
  const ollamaModel = settings.ollamaModel;
  const claudeModel = settings.claudeModel;
  const claudeVersions = settings.claudeModelVersions;
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  const [hooks, setHooks] = useState<ChatHook[]>([]);
  const [enabledHooks, setEnabledHooks] = useState<string[]>([]);

  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [chatUsage, setChatUsage] = useState<TokenUsage | undefined>(undefined);
  const [recent, setRecent] = useState<ChatSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const turnRef = useRef(0);

  const started = messages.some((m) => m.role === "user");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listOllamaModels();
      if (cancelled) return;
      if (res.ok) setModels(res.models);
      setLoadingModels(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadChatHooks();
      if (cancelled) return;
      setHooks(res.hooks);
      setEnabledHooks(res.enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, [hooksVersion]);

  const refreshRecent = useCallback(async () => {
    setLoadingRecent(true);
    const list = await listChats();
    setRecent(list);
    setLoadingRecent(false);
  }, []);

  useEffect(() => {
    if (provider !== "claude_cli") return;
    const allKnown = CLAUDE_MODEL_ALIASES.every((a) => claudeVersions[a]);
    if (allKnown) return;
    let cancelled = false;
    (async () => {
      const map = await resolveClaudeModelVersions();
      if (!cancelled) onLearnClaudeVersions(map);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const selectOllama = (name: string) => {
    void onApplyAiSettings({
      aiProvider: "ollama",
      ollamaEndpoint: settings.ollamaEndpoint,
      ollamaModel: name,
      claudeCliCommand: settings.claudeCliCommand,
      claudeModel,
    });
  };

  const selectClaude = (alias: string) => {
    void onApplyAiSettings({
      aiProvider: "claude_cli",
      ollamaEndpoint: settings.ollamaEndpoint,
      ollamaModel,
      claudeCliCommand: settings.claudeCliCommand,
      claudeModel: alias,
    });
  };

  const changeHooks = (ids: string[]) => {
    setEnabledHooks(ids);
    void saveEnabledHooks(ids);
  };

  const persist = useCallback(
    (id: string, list: ChatMessage[], turnMode: ChatMode, usage?: TokenUsage) => {
      const firstUser = list.find((m) => m.role === "user");
      if (!firstUser) return;
      void saveChat({
        id,
        title: titleFrom(firstUser.text),
        mode: turnMode,
        messages: list,
        usage,
      });
    },
    [],
  );

  const handleSend = async (text: string, modeOverride?: ChatMode) => {
    if (pending) return;
    setError(null);
    const turnMode = modeOverride ?? mode;
    const turn = ++turnRef.current;
    const sessionId = chatId;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      createdAt: new Date(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setPending(true);

    const turns: ChatTurn[] = next.map((m) => ({ role: m.role, content: m.text }));

    const res = await sendChatMessage(turns, turnMode, contextIds, enabledHooks);

    if (turnRef.current !== turn) return;

    if (res.ok) {
      const hasActions = !!res.actions?.length;
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: res.reply,
        createdAt: new Date(),
        actions: hasActions ? res.actions : undefined,
        actionState: hasActions ? "proposed" : undefined,
        noBuildActions: !!res.noActionsWarning,
        usage: res.usage,
      };
      const total = addUsage(chatUsage, res.usage);
      setChatUsage(total);
      setMessages((prev) => [...prev, reply]);
      persist(sessionId, [...next, reply], turnMode, total);
      if (res.model && provider === "claude_cli") {
        onLearnClaudeVersions({ [claudeModel]: res.model });
      }
    } else {
      setError(res.error);
    }
    setPending(false);
  };

  const handleStop = () => {
    if (!pending) return;
    turnRef.current++;
    setPending(false);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Stopped.",
        createdAt: new Date(),
        stopped: true,
      },
    ]);
  };

  const handlePick = (prompt: string, pickMode: ChatMode) => {
    if (pending) return;
    setMode(pickMode);
    void handleSend(prompt, pickMode);
  };

  const newChat = () => {
    turnRef.current++;
    setPending(false);
    setChatId(crypto.randomUUID());
    setMessages([greeting()]);
    setChatUsage(undefined);
    setError(null);
    setApplyingId(null);
  };

  const openChat = async (id: string) => {
    if (id === chatId) return;
    turnRef.current++;
    setPending(false);
    setError(null);
    const chat = await loadChat(id);
    if (!chat) {
      void refreshRecent();
      return;
    }
    setChatId(chat.id);
    setMode(chat.mode);
    setMessages(chat.messages.length ? chat.messages : [greeting()]);
    setChatUsage(chat.usage);
  };

  const removeChat = async (id: string) => {
    await deleteChatAction(id);
    setRecent((prev) => prev.filter((c) => c.id !== id));
    if (id === chatId) newChat();
  };

  const applyActions = async (messageId: string) => {
    if (applyingId) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.actions?.length) return;
    setError(null);
    setApplyingId(messageId);
    const res = await applyChatActions(msg.actions, {
      spaceId: activeSpaceId,
      projectId: activeProjectId,
    });
    if (res.ok) {
      onApplied(res.spaces);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, actionState: "applied" } : m)),
      );
    } else {
      setError(res.error);
    }
    setApplyingId(null);
  };

  const dismissActions = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, actionState: "dismissed" } : m)),
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--paper)",
      }}
    >
      <ChatBar
        chats={recent}
        activeId={chatId}
        loading={loadingRecent}
        onOpenMenu={() => void refreshRecent()}
        onSelect={(id) => void openChat(id)}
        onDelete={(id) => void removeChat(id)}
        onNew={newChat}
        usage={chatUsage}
        empty={!started}
      />

      {hasWorkspace ? (
        <>
          <ChatHistory
            messages={messages}
            pending={pending}
            error={error}
            applyingId={applyingId}
            onApplyActions={applyActions}
            onDismissActions={dismissActions}
          />
          <QuickActions hidden={started} disabled={pending} onPick={handlePick} />
        </>
      ) : (
        <NoWorkspaceNotice onCreateProject={onCreateProject} />
      )}

      <ChatInput
        onSend={handleSend}
        disabled={pending || !hasWorkspace}
        pending={pending}
        onStop={handleStop}
        placeholder={hasWorkspace ? undefined : "Create a project to start chatting…"}
        hooks={hooks}
        selectedHookIds={enabledHooks}
        onHooksChange={changeHooks}
        onManageHooks={onOpenSettings}
        mode={mode}
        onModeChange={setMode}
        provider={provider}
        ollamaModel={ollamaModel}
        claudeModel={claudeModel}
        claudeVersions={claudeVersions}
        ollamaModels={models}
        loadingModels={loadingModels}
        onSelectOllama={selectOllama}
        onSelectClaude={selectClaude}
      />
    </div>
  );
}

function titleFrom(text: string): string {
  const line = text.trim().split("\n")[0].trim();
  if (line.length <= 58) return line || "New chat";
  return `${line.slice(0, 57).trimEnd()}…`;
}
