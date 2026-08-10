"use server";

import { getOrCreateDefaultUser } from "@/lib/db/queries/user";
import {
  deleteChat as deleteChatRow,
  getChat as getChatRow,
  listRecentChats,
  pruneOldChats,
  saveChat as saveChatRow,
} from "@/lib/db/queries/chat";
import type { ChatMessage, ChatMode, ChatSummary, StoredChat, TokenUsage } from "@/lib/types";

export async function listChats(): Promise<ChatSummary[]> {
  try {
    const user = await getOrCreateDefaultUser();
    await pruneOldChats(user.id);
    return await listRecentChats(user.id);
  } catch {
    return [];
  }
}

export async function loadChat(id: string): Promise<StoredChat | null> {
  try {
    const user = await getOrCreateDefaultUser();
    return await getChatRow(user.id, id);
  } catch {
    return null;
  }
}

export interface SaveChatArgs {
  id: string;
  title: string;
  mode: ChatMode;
  messages: ChatMessage[];
  usage?: TokenUsage;
}

export async function saveChat(args: SaveChatArgs): Promise<void> {
  try {
    const user = await getOrCreateDefaultUser();
    await saveChatRow({
      id: args.id,
      userId: user.id,
      title: args.title.trim() || "New chat",
      mode: args.mode,
      messages: args.messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: m.createdAt,
        usage: m.usage,
        stopped: m.stopped,
        noBuildActions: m.noBuildActions,
      })),
      usage: args.usage,
    });
  } catch {
  }
}

export async function deleteChat(id: string): Promise<void> {
  try {
    const user = await getOrCreateDefaultUser();
    await deleteChatRow(user.id, id);
  } catch {
  }
}
