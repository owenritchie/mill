"use client";

import { useState, useMemo, useEffect } from "react";
import { BotMessageSquare, MessagesSquare, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ViewNav, ViewKey } from "./ViewNav";
import { TableView } from "./TableView";
import { CanvasView } from "@/components/canvas/CanvasView";
import { DocPanel, ParsedDoc } from "@/components/doc/DocPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContextPicker } from "@/components/chat/ContextPicker";
import { iconControl } from "@/components/chat/chrome";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Topic, Decision, Space, SpaceProject, ProjectLink, AppSettings, AiSettingsInput } from "@/lib/types";
import { TopicPanel, TopicCreationFields } from "@/components/cards/TopicPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CreateProjectDialog } from "@/components/ui/CreateProjectDialog";
import {
  createTopic as createTopicAction,
  updateTopic as updateTopicAction,
  deleteTopic as deleteTopicAction,
  addDecision as addDecisionAction,
  updateDecision as updateDecisionAction,
  deleteDecision as deleteDecisionAction,
} from "@/app/actions/topic";
import {
  createProject as createProjectAction,
  updateProject as updateProjectAction,
  deleteProject as deleteProjectAction,
  moveProject as moveProjectAction,
  createProjectDeep as createProjectDeepAction,
} from "@/app/actions/project";
import {
  createSpace as createSpaceAction,
  renameSpace as renameSpaceAction,
  deleteSpace as deleteSpaceAction,
} from "@/app/actions/space";
import {
  createLink as createLinkAction,
  deleteLink as deleteLinkAction,
} from "@/app/actions/link";
import { addTag as addTagAction, updateAiSettings } from "@/app/actions/config";

const SIDEBAR_MIN = 260;
const sidebarMax = () => Math.max(SIDEBAR_MIN, Math.round(window.innerWidth / 3));

interface WorkspaceProps {
  initialSpaces: Space[];
  initialActiveProjectId: string | null;
  initialAllTags: string[];
  initialSettings: AppSettings;
}

export function Workspace({
  initialSpaces,
  initialActiveProjectId,
  initialAllTags,
  initialSettings,
}: WorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MIN);
  const [resizing, setResizing] = useState(false);
  const [resizeHover, setResizeHover] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContextIds, setChatContextIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hooksVersion, setHooksVersion] = useState(0);
  const [needProjectForChat, setNeedProjectForChat] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("tree");
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  const applyAiSettings = (next: AiSettingsInput): Promise<void> => {
    setSettings((prev) => ({ ...prev, ...next }));
    return updateAiSettings(next);
  };

  const learnClaudeVersions = (map: Record<string, string>) => {
    setSettings((prev) => {
      let changed = false;
      const merged = { ...prev.claudeModelVersions };
      for (const [alias, model] of Object.entries(map)) {
        if (model && merged[alias] !== model) { merged[alias] = model; changed = true; }
      }
      return changed ? { ...prev, claudeModelVersions: merged } : prev;
    });
  };
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialActiveProjectId);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>(initialAllTags);
  const [composerOpen, setComposerOpen] = useState(false);
  const [needProjectForTopic, setNeedProjectForTopic] = useState(false);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [expandWithDecision, setExpandWithDecision] = useState(false);
  const [focusTopic, setFocusTopic] = useState<{ id: string; nonce: number } | null>(null);
  const [highlightTag, setHighlightTag] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "topic"; id: string; label: string }
    | { kind: "project"; id: string; label: string }
    | null
  >(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(sidebarMax(), Math.max(SIDEBAR_MIN, startW + ev.clientX - startX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    const onResize = () => setSidebarWidth((w) => Math.min(w, sidebarMax()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const activeProject = useMemo(
    () => spaces.flatMap((s) => s.projects).find((p) => p.id === activeProjectId) ?? null,
    [spaces, activeProjectId]
  );
  const hasAnyProject = useMemo(() => spaces.some((s) => s.projects.length > 0), [spaces]);
  const topics = activeProject?.topics ?? [];

  const revertTo = (snapshot: Space[]) => (err: unknown) => {
    console.error("Mill: change could not be saved, reverting.", err);
    setSpaces(snapshot);
  };

  const setActiveTopics = (updater: (topics: Topic[]) => Topic[]) =>
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === activeProjectId ? { ...p, topics: updater(p.topics) } : p
        ),
      }))
    );

  const selectProject = (id: string) => {
    setActiveProjectId(id);
    setActiveTopicId(null);
    setHighlightTag(null);
  };

  const focusTopicInCanvas = (id: string) => {
    let owningProjectId = activeProjectId;
    for (const s of spaces) {
      for (const p of s.projects) {
        if (p.topics.some((t) => t.id === id)) owningProjectId = p.id;
      }
    }
    setActiveView("tree");
    if (owningProjectId && owningProjectId !== activeProjectId) setActiveProjectId(owningProjectId);
    setActiveTopicId(id);
    setFocusTopic((f) => ({ id, nonce: (f?.nonce ?? 0) + 1 }));
  };

  const editTopic = (id: string, fields: Partial<Topic>) => {
    const snapshot = spaces;
    setActiveTopics((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) patch[k] = v === undefined ? null : v;
    updateTopicAction(id, patch as Parameters<typeof updateTopicAction>[1]).catch(revertTo(snapshot));
  };

  const editDecision = (topicId: string, decisionId: string, fields: Partial<Decision>) => {
    const snapshot = spaces;
    setActiveTopics((prev) =>
      prev.map((i) =>
        i.id !== topicId
          ? i
          : { ...i, decisions: i.decisions.map((d) => (d.id === decisionId ? { ...d, ...fields } : d)) }
      )
    );
    updateDecisionAction(decisionId, fields).catch(revertTo(snapshot));
  };

  const editTopicAnywhere = (id: string, fields: Partial<Topic>) => {
    const snapshot = spaces;
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) => ({
          ...p,
          topics: p.topics.map((i) => (i.id === id ? { ...i, ...fields } : i)),
        })),
      }))
    );
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) patch[k] = v === undefined ? null : v;
    updateTopicAction(id, patch as Parameters<typeof updateTopicAction>[1]).catch(revertTo(snapshot));
  };

  const editDecisionAnywhere = (topicId: string, decisionId: string, fields: Partial<Decision>) => {
    const snapshot = spaces;
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) => ({
          ...p,
          topics: p.topics.map((i) =>
            i.id !== topicId
              ? i
              : { ...i, decisions: i.decisions.map((d) => (d.id === decisionId ? { ...d, ...fields } : d)) }
          ),
        })),
      }))
    );
    updateDecisionAction(decisionId, fields).catch(revertTo(snapshot));
  };

  const allScopedTopics = useMemo(
    () =>
      spaces.flatMap((s) =>
        s.projects.flatMap((p) =>
          p.topics.map((topic) => ({
            topic,
            scope: {
              projectId: p.id,
              spaceId: s.id,
              projectName: p.name,
              color: p.color,
              spaceName: s.name,
            },
          }))
        )
      ),
    [spaces]
  );

  const activeSpaceId = useMemo(
    () => spaces.find((s) => s.projects.some((p) => p.id === activeProjectId))?.id ?? null,
    [spaces, activeProjectId]
  );

  const openTopicForNewDecision = (topicId: string) => {
    let owner: string | null = null;
    for (const s of spaces) {
      for (const p of s.projects) {
        if (p.topics.some((t) => t.id === topicId)) owner = p.id;
      }
    }
    if (!owner) return;
    if (owner !== activeProjectId) {
      setActiveProjectId(owner);
      setActiveTopicId(topicId);
    }
    setExpandWithDecision(true);
    setExpandedTopicId(topicId);
  };

  const openTopic = (id: string | null) => {
    setExpandWithDecision(false);
    setExpandedTopicId(id);
  };

  const deleteDecision = (topicId: string, decisionId: string) => {
    const snapshot = spaces;
    setActiveTopics((prev) =>
      prev.map((i) =>
        i.id !== topicId ? i : { ...i, decisions: i.decisions.filter((d) => d.id !== decisionId) }
      )
    );
    deleteDecisionAction(decisionId).catch(revertTo(snapshot));
  };

  const addDecision = (topicId: string, title: string) => {
    const snapshot = spaces;
    const topic = topics.find((i) => i.id === topicId);
    const id = crypto.randomUUID();
    const position = topic ? topic.decisions.length : 0;
    setActiveTopics((prev) =>
      prev.map((i) =>
        i.id !== topicId ? i : { ...i, decisions: [...i.decisions, { id, title, note: "", position }] }
      )
    );
    addDecisionAction({ id, topicId, title, position }).catch(revertTo(snapshot));
  };

  const replaceTopic = (next: Topic) => {
    setActiveTopics((prev) => prev.map((i) => (i.id === next.id ? next : i)));
  };

  const toggleCollapsed = (id: string) => {
    const snapshot = spaces;
    const topic = topics.find((i) => i.id === id);
    const next = !topic?.collapsed;
    setActiveTopics((prev) => prev.map((i) => (i.id === id ? { ...i, collapsed: next } : i)));
    updateTopicAction(id, { collapsed: next }).catch(revertTo(snapshot));
  };

  const openComposer = () => {
    if (!activeProjectId) {
      setNeedProjectForTopic(true);
      return;
    }
    setComposerOpen(true);
  };

  const createFirstProject = (name: string) => {
    const snapshot = spaces;

    const existingSpaceId =
      spaces.find((s) => s.projects.some((p) => p.id === activeProjectId))?.id ??
      spaces[0]?.id ??
      null;
    const newSpace = existingSpaceId
      ? null
      : { id: crypto.randomUUID(), name: "Workspace", position: spaces.length };
    const spaceId = existingSpaceId ?? newSpace!.id;

    let working = spaces;
    if (newSpace) working = [...working, { id: newSpace.id, name: newSpace.name, projects: [] }];

    const projectId = crypto.randomUUID();
    const position = working.find((s) => s.id === spaceId)?.projects.length ?? 0;
    working = working.map((s) =>
      s.id === spaceId
        ? { ...s, projects: [...s.projects, { id: projectId, name, tagline: "", color: "#2A8C7A", topics: [], links: [] }] }
        : s
    );

    setSpaces(working);
    setActiveProjectId(projectId);
    setActiveTopicId(null);

    (async () => {
      if (newSpace) await createSpaceAction(newSpace);
      await createProjectAction({ id: projectId, spaceId, name, position });
    })().catch(revertTo(snapshot));
  };

  const createProjectForTopic = (name: string) => {
    createFirstProject(name);
    setNeedProjectForTopic(false);
    setComposerOpen(true);
  };

  const createProjectForChat = (name: string) => {
    createFirstProject(name);
    setNeedProjectForChat(false);
  };

  const createTopicForProject = (projectId: string) => {
    if (projectId !== activeProjectId) {
      setActiveProjectId(projectId);
      setActiveTopicId(null);
    }
    setComposerOpen(true);
  };

  const commitTopic = (fields: TopicCreationFields) => {
    if (!activeProjectId) return;
    const snapshot = spaces;
    const id = crypto.randomUUID();
    const decisions = fields.decisions.map((d, i) => ({
      id: crypto.randomUUID(),
      title: d.title.trim(),
      note: d.note,
      position: i,
    }));
    const position = topics.length;
    const newTopic: Topic = {
      id,
      title: fields.title,
      summary: fields.summary,
      tone: fields.tone,
      priority: fields.priority,
      tags: fields.tags,
      issueUrl: fields.issueUrl,
      startDate: fields.startDate,
      endDate: fields.endDate,
      collapsed: false,
      position,
      decisions,
    };
    setActiveTopics((prev) => [...prev, newTopic]);
    setActiveTopicId(id);
    setComposerOpen(false);
    createTopicAction({
      id,
      projectId: activeProjectId,
      title: fields.title,
      summary: fields.summary,
      tone: fields.tone,
      priority: fields.priority,
      tags: fields.tags,
      collapsed: false,
      position,
      startDate: fields.startDate,
      endDate: fields.endDate,
      issueUrl: fields.issueUrl,
      decisions,
    }).catch(revertTo(snapshot));
  };

  const deleteTopic = (id: string) => {
    const snapshot = spaces;
    setActiveTopics((prev) => prev.filter((i) => i.id !== id));
    setActiveTopicId((prev) => (prev === id ? null : prev));
    deleteTopicAction(id).catch(revertTo(snapshot));
  };

  const requestDeleteTopic = (id: string) => {
    const t = topics.find((x) => x.id === id);
    setPendingDelete({ kind: "topic", id, label: t?.title?.trim() || "Untitled topic" });
  };

  const requestDeleteProject = (id: string) => {
    const p = spaces.flatMap((s) => s.projects).find((x) => x.id === id);
    setPendingDelete({ kind: "project", id, label: p?.name?.trim() || "this project" });
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "topic") {
      deleteTopic(pendingDelete.id);
      setExpandedTopicId((prev) => (prev === pendingDelete.id ? null : prev));
    } else {
      deleteProject(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  const duplicateTopic = (id: string) => {
    if (!activeProjectId) return;
    const snapshot = spaces;
    const src = topics.find((i) => i.id === id);
    if (!src) return;
    const newId = crypto.randomUUID();
    const decisions = src.decisions.map((d, i) => ({
      id: crypto.randomUUID(), title: d.title, note: d.note, position: i,
    }));
    const position = topics.length;
    const newTopic: Topic = { ...src, id: newId, title: `${src.title} (copy)`, collapsed: false, position, decisions };
    setActiveTopics((prev) => [...prev, newTopic]);
    setActiveTopicId(newId);
    createTopicAction({
      id: newId,
      projectId: activeProjectId,
      title: newTopic.title,
      summary: src.summary,
      tone: src.tone,
      priority: src.priority ?? null,
      tags: src.tags,
      collapsed: false,
      position,
      startDate: src.startDate,
      endDate: src.endDate,
      issueUrl: src.issueUrl,
      decisions,
    }).catch(revertTo(snapshot));
  };

  const syncProjectFromDoc = (doc: ParsedDoc) => {
    if (!activeProject || !activeProjectId) return;
    const projectId = activeProjectId;
    const snapshot = spaces;
    const calls: Promise<void>[] = [];

    const sameTags = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);

    const projFields: { name?: string; tagline?: string } = {};
    if (doc.title.trim() && doc.title !== activeProject.name) projFields.name = doc.title;
    if (doc.tagline !== (activeProject.tagline ?? "")) projFields.tagline = doc.tagline;
    if (Object.keys(projFields).length) calls.push(updateProjectAction(projectId, projFields));

    const existing = activeProject.topics;
    const nextTopics: Topic[] = [];

    doc.topics.forEach((pTopic, i) => {
      const cur = existing[i];
      if (cur) {
        const next: Partial<Topic> = {};
        const patch: Record<string, unknown> = {};
        if (pTopic.title !== cur.title) { next.title = pTopic.title; patch.title = pTopic.title; }
        if (pTopic.summary !== cur.summary) { next.summary = pTopic.summary; patch.summary = pTopic.summary; }
        const newTone = pTopic.tone ?? cur.tone;
        if (newTone !== cur.tone) { next.tone = newTone; patch.tone = newTone; }
        const newPriority = pTopic.priority ?? null;
        if (newPriority !== (cur.priority ?? null)) { next.priority = newPriority; patch.priority = newPriority; }
        if (!sameTags(pTopic.tags, cur.tags ?? [])) { next.tags = pTopic.tags; patch.tags = pTopic.tags; }
        if ((pTopic.startDate ?? null) !== (cur.startDate ?? null)) { next.startDate = pTopic.startDate ?? undefined; patch.startDate = pTopic.startDate; }
        if ((pTopic.endDate ?? null) !== (cur.endDate ?? null)) { next.endDate = pTopic.endDate ?? undefined; patch.endDate = pTopic.endDate; }
        if ((pTopic.issueUrl ?? null) !== (cur.issueUrl ?? null)) { next.issueUrl = pTopic.issueUrl ?? undefined; patch.issueUrl = pTopic.issueUrl; }
        if (Object.keys(patch).length) calls.push(updateTopicAction(cur.id, patch as Parameters<typeof updateTopicAction>[1]));

        const nextDecisions: Decision[] = [];
        pTopic.decisions.forEach((pDec, j) => {
          const curDec = cur.decisions[j];
          if (curDec) {
            const dFields: Partial<Decision> = {};
            if (pDec.title !== curDec.title) dFields.title = pDec.title;
            if (pDec.note !== curDec.note) dFields.note = pDec.note;
            if (Object.keys(dFields).length) calls.push(updateDecisionAction(curDec.id, dFields));
            nextDecisions.push({ ...curDec, ...dFields });
          } else {
            const id = crypto.randomUUID();
            calls.push(addDecisionAction({ id, topicId: cur.id, title: pDec.title, note: pDec.note, position: j }));
            nextDecisions.push({ id, title: pDec.title, note: pDec.note, position: j });
          }
        });
        for (let j = pTopic.decisions.length; j < cur.decisions.length; j++) {
          calls.push(deleteDecisionAction(cur.decisions[j].id));
        }
        nextTopics.push({ ...cur, ...next, decisions: nextDecisions });
      } else {
        const id = crypto.randomUUID();
        const tone = pTopic.tone ?? "ink";
        const priority = pTopic.priority ?? null;
        const decisions = pTopic.decisions.map((d, j) => ({
          id: crypto.randomUUID(),
          title: d.title,
          note: d.note,
          position: j,
        }));
        const newTopic: Topic = {
          id,
          title: pTopic.title,
          summary: pTopic.summary,
          tone,
          priority,
          tags: pTopic.tags,
          collapsed: false,
          position: i,
          decisions,
          startDate: pTopic.startDate ?? undefined,
          endDate: pTopic.endDate ?? undefined,
          issueUrl: pTopic.issueUrl ?? undefined,
        };
        nextTopics.push(newTopic);
        calls.push(
          createTopicAction({
            id,
            projectId,
            title: pTopic.title,
            summary: pTopic.summary,
            tone,
            priority,
            tags: pTopic.tags,
            collapsed: false,
            position: i,
            startDate: pTopic.startDate ?? undefined,
            endDate: pTopic.endDate ?? undefined,
            issueUrl: pTopic.issueUrl ?? undefined,
            decisions,
          })
        );
      }
    });

    for (let i = doc.topics.length; i < existing.length; i++) {
      calls.push(deleteTopicAction(existing[i].id));
    }

    const desired = new Map<string, ProjectLink>();
    for (const edge of doc.links) {
      const out = nextTopics[edge.from - 1];
      const inb = nextTopics[edge.to - 1];
      if (!out || !inb || out.id === inb.id) continue;
      desired.set(`${out.id}|${inb.id}`, { outbound: out.id, inbound: inb.id });
    }
    const existingLinks = activeProject.links ?? [];
    const existingKeys = new Set(existingLinks.map((l) => `${l.outbound}|${l.inbound}`));
    const nextTopicIds = new Set(nextTopics.map((topic) => topic.id));
    for (const [key, link] of desired) {
      if (!existingKeys.has(key)) calls.push(createLinkAction(link.outbound, link.inbound));
    }
    for (const l of existingLinks) {
      const key = `${l.outbound}|${l.inbound}`;
      if (!desired.has(key) && nextTopicIds.has(l.outbound) && nextTopicIds.has(l.inbound)) {
        calls.push(deleteLinkAction(l.outbound, l.inbound));
      }
    }
    const nextLinks = [...desired.values()];

    if (calls.length === 0) return;

    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                name: projFields.name ?? p.name,
                tagline: projFields.tagline ?? p.tagline,
                topics: nextTopics,
                links: nextLinks,
              }
            : p
        ),
      }))
    );

    Promise.all(calls).catch(revertTo(snapshot));
  };

  const createProjectLink = (outbound: string, inbound: string) => {
    const snapshot = spaces;
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === activeProjectId &&
          !p.links.some((l) => l.outbound === outbound && l.inbound === inbound)
            ? { ...p, links: [...p.links, { outbound, inbound }] }
            : p
        ),
      }))
    );
    createLinkAction(outbound, inbound).catch(revertTo(snapshot));
  };

  const deleteProjectLink = (outbound: string, inbound: string) => {
    const snapshot = spaces;
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === activeProjectId
            ? { ...p, links: p.links.filter((l) => !(l.outbound === outbound && l.inbound === inbound)) }
            : p
        ),
      }))
    );
    deleteLinkAction(outbound, inbound).catch(revertTo(snapshot));
  };

  const createTag = (tag: string) => {
    if (allTags.includes(tag)) return;
    const snapshot = allTags;
    setAllTags((prev) => [...prev, tag]);
    addTagAction(tag).catch((err) => {
      console.error("Mill: tag could not be saved, reverting.", err);
      setAllTags(snapshot);
    });
  };

  const addProject = (spaceId: string, name: string) => {
    const snapshot = spaces;
    const id = crypto.randomUUID();
    const space = spaces.find((s) => s.id === spaceId);
    const position = space ? space.projects.length : 0;
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === spaceId
          ? { ...s, projects: [...s.projects, { id, name, tagline: "", color: "#2A8C7A", topics: [], links: [] }] }
          : s
      )
    );
    setActiveProjectId(id);
    setActiveTopicId(null);
    createProjectAction({ id, spaceId, name, position }).catch(revertTo(snapshot));
  };

  const addSpace = (name: string) => {
    const snapshot = spaces;
    const id = crypto.randomUUID();
    const position = spaces.length;
    setSpaces((prev) => [...prev, { id, name, projects: [] }]);
    createSpaceAction({ id, name, position }).catch(revertTo(snapshot));
  };

  const renameSpace = (spaceId: string, name: string) => {
    const snapshot = spaces;
    setSpaces((prev) => prev.map((s) => (s.id === spaceId ? { ...s, name } : s)));
    renameSpaceAction(spaceId, name).catch(revertTo(snapshot));
  };

  const deleteSpace = (spaceId: string) => {
    const snapshot = spaces;
    const deletedProjects = spaces.find((s) => s.id === spaceId)?.projects ?? [];
    const deletedIds = new Set(deletedProjects.map((p) => p.id));
    const remaining = spaces.flatMap((s) => (s.id === spaceId ? [] : s.projects));
    setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
    if (activeProjectId && deletedIds.has(activeProjectId)) {
      setActiveProjectId(remaining[0]?.id ?? null);
      setActiveTopicId(null);
    }
    deleteSpaceAction(spaceId).catch(revertTo(snapshot));
  };

  const changeProjectColor = (projectId: string, color: string) => {
    const snapshot = spaces;
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === projectId ? { ...p, color } : p)),
      }))
    );
    updateProjectAction(projectId, { color }).catch(revertTo(snapshot));
  };

  const renameProject = (projectId: string, name: string) => {
    const snapshot = spaces;
    setSpaces((prev) =>
      prev.map((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === projectId ? { ...p, name } : p)),
      }))
    );
    updateProjectAction(projectId, { name }).catch(revertTo(snapshot));
  };

  const deleteProject = (projectId: string) => {
    const snapshot = spaces;
    const allProjects = spaces.flatMap((s) => s.projects);
    const remaining = allProjects.filter((p) => p.id !== projectId);
    setSpaces((prev) =>
      prev.map((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== projectId) }))
    );
    if (activeProjectId === projectId) {
      const next = remaining[0] ?? null;
      setActiveProjectId(next?.id ?? null);
      setActiveTopicId(null);
    }
    deleteProjectAction(projectId).catch(revertTo(snapshot));
  };

  const duplicateProject = (projectId: string) => {
    const snapshot = spaces;
    let sourceSpaceId: string | null = null;
    let source: SpaceProject | undefined;
    for (const s of spaces) {
      const found = s.projects.find((p) => p.id === projectId);
      if (found) {
        source = found;
        sourceSpaceId = s.id;
        break;
      }
    }
    if (!source || !sourceSpaceId) return;
    const newId = crypto.randomUUID();
    const dupTopics: Topic[] = source.topics.map((i) => ({
      ...i,
      id: crypto.randomUUID(),
      decisions: i.decisions.map((d) => ({ ...d, id: crypto.randomUUID() })),
    }));
    const newProject: SpaceProject = {
      id: newId,
      name: `${source.name} (copy)`,
      tagline: source.tagline,
      color: source.color,
      topics: dupTopics,
      links: [],
    };
    const space = spaces.find((s) => s.id === sourceSpaceId)!;
    const idx = space.projects.findIndex((p) => p.id === projectId);
    const position = idx + 1;
    setSpaces((prev) =>
      prev.map((s) => {
        if (s.id !== sourceSpaceId) return s;
        const updated = [...s.projects];
        updated.splice(idx + 1, 0, newProject);
        return { ...s, projects: updated };
      })
    );
    createProjectDeepAction({
      id: newId,
      spaceId: sourceSpaceId,
      name: newProject.name,
      tagline: newProject.tagline,
      color: newProject.color,
      position,
      topics: dupTopics.map((i) => ({
        id: i.id,
        title: i.title,
        summary: i.summary,
        tone: i.tone,
        priority: i.priority,
        tags: i.tags,
        collapsed: i.collapsed,
        position: i.position,
        startDate: i.startDate,
        endDate: i.endDate,
        issueUrl: i.issueUrl,
        decisions: i.decisions.map((d) => ({
          id: d.id,
          title: d.title,
          note: d.note,
          position: d.position,
        })),
      })),
    }).catch(revertTo(snapshot));
  };

  const moveProject = (projectId: string, targetSpaceId: string) => {
    const snapshot = spaces;
    let project: SpaceProject | undefined;
    const without = spaces.map((s) => {
      const found = s.projects.find((p) => p.id === projectId);
      if (found) {
        project = found;
        return { ...s, projects: s.projects.filter((p) => p.id !== projectId) };
      }
      return s;
    });
    if (!project) return;
    const target = without.find((s) => s.id === targetSpaceId);
    const position = target ? target.projects.length : 0;
    setSpaces(
      without.map((s) => (s.id === targetSpaceId ? { ...s, projects: [...s.projects, project!] } : s))
    );
    moveProjectAction({ id: projectId, targetSpaceId, position }).catch(revertTo(snapshot));
  };

  const totalDecisions = topics.reduce((sum, i) => sum + i.decisions.length, 0);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--paper)" }}>
      <div
        style={{
          flexShrink: 0,
          width: sidebarOpen ? sidebarWidth : 0,
          overflow: "hidden",
          transition: resizing ? "none" : "width 0.34s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          style={{
            width: sidebarWidth,
            height: "100%",
            transform: sidebarOpen ? "translateX(0)" : `translateX(-${sidebarWidth}px)`,
            visibility: sidebarOpen ? "visible" : "hidden",
            transition: resizing
              ? "none"
              : sidebarOpen
                ? "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s"
                : "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s 0.34s",
          }}
        >
          <Sidebar
            spaces={spaces}
            activeProjectId={activeProjectId}
            onSelectProject={selectProject}
            onAddProject={addProject}
            onAddSpace={addSpace}
            onRenameProject={renameProject}
            onDeleteProject={requestDeleteProject}
            onDuplicateProject={duplicateProject}
            onChangeProjectColor={changeProjectColor}
            onDeleteSpace={deleteSpace}
            onRenameSpace={renameSpace}
            onMoveProject={moveProject}
            onOpenSettings={() => setSettingsOpen(true)}
            topics={topics}
            activeTopicId={activeTopicId}
            onActivateTopic={focusTopicInCanvas}
            onOpenTopic={openTopic}
            onCreateTopic={createTopicForProject}
            onDuplicateTopic={duplicateTopic}
            onDeleteTopic={requestDeleteTopic}
            highlightTag={highlightTag}
            onSelectTag={(tag) => setHighlightTag((cur) => (cur === tag ? null : tag))}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: "relative", width: 0, flexShrink: 0, zIndex: 10 }}>
          <div
            onMouseDown={startResize}
            onMouseEnter={() => setResizeHover(true)}
            onMouseLeave={() => setResizeHover(false)}
            title="Drag to resize"
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 9, cursor: "col-resize" }}
          >
            <div
              style={{
                position: "absolute", top: 0, bottom: 0, left: 0, width: 2,
                background: "var(--forest)",
                opacity: resizing || resizeHover ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            />
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <ViewNav
          activeView={activeView}
          onChangeView={setActiveView}
          topicCount={topics.length}
          decisionCount={totalDecisions}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          projectTitle={activeProject?.name}
          topics={topics}
          tagline={activeProject?.tagline}
          links={activeProject?.links}
        />
        <div style={{ flex: 1, overflow: "hidden", background: "var(--paper-2)" }}>
          {activeView === "tree" && (
            <div style={{ height: "100%", overflow: "hidden" }}>
              <CanvasView
                key={activeProjectId}
                topics={topics}
                initialLinks={activeProject?.links ?? []}
                activeId={activeTopicId}
                highlightTag={highlightTag}
                focus={focusTopic}
                onActivate={setActiveTopicId}
                onAddTopic={openComposer}
                onDeleteTopic={requestDeleteTopic}
                onExpandTopic={openTopic}
                onToggleCollapsed={toggleCollapsed}
                onCreateLink={createProjectLink}
                onDeleteLink={deleteProjectLink}
              />
            </div>
          )}

          {activeView === "table" && (
            <TableView
              topics={topics}
              allTopics={allScopedTopics}
              activeSpaceId={activeSpaceId}
              activeProjectName={activeProject?.name}
              allTags={allTags}
              onCreateTag={createTag}
              onEditTopic={editTopicAnywhere}
              onEditDecision={editDecisionAnywhere}
              onAddTopic={openComposer}
              onAddDecision={openTopicForNewDecision}
            />
          )}

          {activeView === "docs" && (
            <div style={{ height: "100%", overflow: "hidden" }}>
              <DocPanel
                key={activeProjectId}
                projectTitle={activeProject?.name ?? "Mill"}
                projectTagline={activeProject?.tagline}
                topics={topics}
                links={activeProject?.links ?? []}
                onSync={syncProjectFromDoc}
              />
            </div>
          )}
        </div>
      </div>
      {needProjectForTopic && (
        <CreateProjectDialog
          onCreate={createProjectForTopic}
          onCancel={() => setNeedProjectForTopic(false)}
        />
      )}

      {needProjectForChat && (
        <CreateProjectDialog
          title="Create a project first"
          detail="The chat reads your workspace and builds into it. Name a project to give it something to work with."
          onCreate={createProjectForChat}
          onCancel={() => setNeedProjectForChat(false)}
        />
      )}

      {composerOpen && (
        <TopicPanel
          mode="create"
          allTags={allTags}
          onCommit={commitTopic}
          onCancel={() => setComposerOpen(false)}
          onCreateTag={createTag}
        />
      )}

      {expandedTopicId && (() => {
        const topic = topics.find((i) => i.id === expandedTopicId);
        if (!topic) return null;
        return (
          <TopicPanel
            mode="edit"
            topic={topic}
            allTags={allTags}
            onEditTopic={(fields) => editTopic(expandedTopicId, fields)}
            onEditDecision={(decId, fields) => editDecision(expandedTopicId, decId, fields)}
            onDeleteDecision={(decId) => deleteDecision(expandedTopicId, decId)}
            onAddDecision={(title) => addDecision(expandedTopicId, title)}
            onTopicReplaced={replaceTopic}
            onClose={() => openTopic(null)}
            onDeleteTopic={() => requestDeleteTopic(expandedTopicId)}
            onCreateTag={createTag}
            autoAddDecision={expandWithDecision}
          />
        );
      })()}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete “${pendingDelete.label}”?`}
          detail={pendingDelete.kind === "project" ? "Its topics and links are removed too." : undefined}
          requireText={pendingDelete.kind === "project" ? "delete" : undefined}
          confirmLabel="Delete"
          onConfirm={confirmPendingDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {chatOpen && (
        <div style={{
          position: "fixed",
          bottom: 88,
          right: 24,
          width: 420,
          maxWidth: "calc(100vw - 48px)",
          height: 680,
          maxHeight: "calc(100vh - 112px)",
          background: "var(--paper)",
          borderRadius: 14,
          boxShadow: "0 24px 48px -16px rgba(30,33,43,0.22), 0 4px 12px -4px rgba(30,33,43,0.10)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: 200,
          border: "1px solid var(--line)",
        }}>
          <div style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 8px 8px 14px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
              <MessagesSquare size={16} strokeWidth={2} style={{ color: "var(--ink)", flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                Chat
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
              <ContextPicker
                spaces={spaces}
                selected={chatContextIds}
                onChange={setChatContextIds}
              />
              <button
                onClick={() => setChatOpen(false)}
                title="Close chat"
                aria-label="Close chat"
                style={iconControl}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--paper-3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--ink-3)";
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ChatPanel
              settings={settings}
              onApplyAiSettings={applyAiSettings}
              onLearnClaudeVersions={learnClaudeVersions}
              contextIds={chatContextIds}
              activeProjectId={activeProjectId}
              activeSpaceId={activeSpaceId}
              onApplied={setSpaces}
              hasWorkspace={hasAnyProject}
              onCreateProject={() => setNeedProjectForChat(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              hooksVersion={hooksVersion}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setChatOpen((v) => !v)}
        title="Chat"
        className="canvas-button-large"
        style={{ position: "fixed", bottom: 24, right: 24, width: 52, height: 52, zIndex: 201 }}
      >
        <BotMessageSquare size={26} />
      </button>

      {settingsOpen && (
        <SettingsModal
          key={`${settings.aiProvider}:${settings.ollamaModel}:${settings.claudeModel}`}
          settings={settings}
          onApplyAiSettings={applyAiSettings}
          onHooksSaved={() => setHooksVersion((v) => v + 1)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
