"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown, Search,
  Plus, MoreHorizontal, Pencil, Copy, FileDown, Trash2, Check, X,
  LayersPlus, FolderPlus, Settings, PanelLeftClose, Maximize2,
} from "lucide-react";
import { Topic, Space, SpaceProject, Tone, TONE_META } from "@/lib/types";
import { buildMarkdown, downloadFile } from "@/lib/export";

const C = {
  bg: "transparent",
  sidebar: "#f6f6f6",
  hover: "#ededec",
  active: "#D0E7B8",
  activeStrong: "#b8d9a0",
  text: "#1E212B",
  muted: "#6c707a",
  border: "#e4e4e4",
  input: "#f0f0f0",
};

const PROJECT_TONES: Tone[] = ["forest", "sage", "coral", "peri", "rose", "butter", "plum", "ink"];
const PROJECT_COLORS = PROJECT_TONES.map((t) => TONE_META[t].base);

const TONE_BY_BASE: Record<string, { base: string; soft: string; deep: string }> =
  Object.fromEntries(
    Object.values(TONE_META).map((t) => [t.base.toLowerCase(), { base: t.base, soft: t.soft, deep: t.deep }])
  );

function projectTone(color: string): { base: string; soft: string; deep: string } {
  return (
    TONE_BY_BASE[color.toLowerCase()] ?? {
      base: color,
      soft: `color-mix(in oklab, ${color} 20%, var(--paper))`,
      deep: `color-mix(in oklab, ${color} 64%, var(--ink))`,
    }
  );
}

function colorChipStyle(color: string, size = 13): React.CSSProperties {
  return {
    width: size, height: size, borderRadius: 4, background: color,
    flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(20,29,21,0.10)",
  };
}

const TREE_ICON_HOVER_BG = "color-mix(in oklab, var(--forest) 13%, transparent)";

const menuIconSize = 14;
const onTreeIconEnter = (e: React.MouseEvent) => {
  (e.currentTarget as HTMLElement).style.background = TREE_ICON_HOVER_BG;
};
const onTreeIconLeave = (e: React.MouseEvent) => {
  (e.currentTarget as HTMLElement).style.background = "transparent";
};

function SearchField({
  value, onChange, placeholder, size = "md", inputRef, onClick,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  size?: "sm" | "md";
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [focused, setFocused] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? internalRef;
  const d = size === "sm"
    ? { height: 30, padding: "0 9px", gap: 6, font: 12, icon: 12, radius: 7, clear: 17, clearIcon: 11 }
    : { height: 33, padding: "0 10px", gap: 8, font: 13, icon: 13.5, radius: 8, clear: 18, clearIcon: 12.5 };
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: d.gap,
        background: "transparent",
        border: `1px solid ${focused ? C.text : C.border}`,
        borderRadius: d.radius, padding: d.padding,
        height: d.height, boxSizing: "border-box",
        boxShadow: "none",
        transition: "border-color 0.15s ease",
      }}
    >
      <Search size={d.icon} style={{ color: focused ? C.text : "#a8acb3", flexShrink: 0, transition: "color 0.15s ease" }} />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
          fontSize: d.font, color: C.text, fontFamily: "inherit", padding: 0,
        }}
        onKeyDown={(e) => { if (e.key === "Escape") { onChange(""); (e.currentTarget as HTMLInputElement).blur(); } }}
      />
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(""); ref.current?.focus(); }}
          title="Clear search"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: d.clear, height: d.clear, borderRadius: 5, flexShrink: 0,
            background: "transparent", border: "none", cursor: "pointer", color: C.muted, padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
        >
          <X size={d.clearIcon} />
        </button>
      )}
    </div>
  );
}

interface Props {
  spaces: Space[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: (spaceId: string, name: string) => void;
  onAddSpace: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onChangeProjectColor: (id: string, color: string) => void;
  onDeleteSpace: (id: string) => void;
  onRenameSpace: (id: string, name: string) => void;
  onMoveProject: (projectId: string, targetSpaceId: string) => void;
  onOpenSettings: () => void;
  topics: Topic[];
  activeTopicId: string | null;
  onActivateTopic: (id: string) => void;
  onOpenTopic: (id: string) => void;
  onCreateTopic: (projectId: string) => void;
  onDuplicateTopic: (id: string) => void;
  onDeleteTopic: (id: string) => void;
  highlightTag: string | null;
  onSelectTag: (tag: string) => void;
  onToggleSidebar?: () => void;
}

function exportMarkdown(project: SpaceProject) {
  const filename = `${project.name.replace(/\s+/g, "-").toLowerCase()}.md`;
  const md = buildMarkdown(project.name, project.topics, { tagline: project.tagline, links: project.links });
  downloadFile(filename, md, "text/markdown");
}

export function Sidebar({
  spaces,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onAddSpace,
  onRenameProject,
  onDeleteProject,
  onDuplicateProject,
  onChangeProjectColor,
  onDeleteSpace,
  onRenameSpace,
  onMoveProject,
  onOpenSettings,
  topics,
  activeTopicId,
  onActivateTopic,
  onOpenTopic,
  onCreateTopic,
  onDuplicateTopic,
  onDeleteTopic,
  highlightTag,
  onSelectTag,
  onToggleSidebar,
}: Props) {
  const [search, setSearch] = useState("");
  const firstSpaceId = spaces[0]?.id ?? "";

  const allProjects = spaces.flatMap((s, si) =>
    s.projects.map((p, pi) => ({
      ...p,
      spaceId: s.id,
      spaceName: s.name,
      color: p.color ?? PROJECT_COLORS[(si * 10 + pi) % PROJECT_COLORS.length],
    }))
  );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? allProjects.filter((p) => p.name.toLowerCase().includes(q))
    : allProjects;

  const TOPIC_RESULT_CAP = 30;
  const topicResults = q
    ? spaces.flatMap((s) =>
        s.projects.flatMap((p) =>
          p.topics
            .filter(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                (t.summary?.toLowerCase().includes(q) ?? false) ||
                (t.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false)
            )
            .map((t) => ({ topic: t, projectName: p.name }))
        )
      ).slice(0, TOPIC_RESULT_CAP)
    : [];

  const tagCounts: Record<string, number> = {};
  for (const topic of topics) {
    for (const tag of topic.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  const searchNode = (
    <SearchField
      value={search}
      onChange={setSearch}
      placeholder="Search projects & topics"
    />
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: C.sidebar,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ProjectsPanel
          spaces={spaces}
          allProjects={filtered}
          activeProjectId={activeProjectId}
          firstSpaceId={firstSpaceId}
          searchNode={searchNode}
          onToggleSidebar={onToggleSidebar}
          onOpenSettings={onOpenSettings}
          activeTopicId={activeTopicId}
          onActivateTopic={onActivateTopic}
          onOpenTopic={onOpenTopic}
          onCreateTopic={onCreateTopic}
          onDuplicateTopic={onDuplicateTopic}
          onDeleteTopic={onDeleteTopic}
          topicResults={topicResults}
          onOpenTopicResult={(topicId) => { onActivateTopic(topicId); setSearch(""); }}
          onSelectProject={(id) => { onSelectProject(id); setSearch(""); }}
          onAddProject={onAddProject}
          onAddSpace={onAddSpace}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
          onDuplicateProject={onDuplicateProject}
          onChangeProjectColor={onChangeProjectColor}
          onDeleteSpace={onDeleteSpace}
          onRenameSpace={onRenameSpace}
          onMoveProject={onMoveProject}
          onExportProject={(id) => {
            const proj = allProjects.find((p) => p.id === id);
            if (proj) exportMarkdown(proj);
          }}
          topics={topics}
          isFiltering={!!search.trim()}
        />
        <TagsSection tags={tags} selectedTag={highlightTag} onSelectTag={onSelectTag} />
      </div>
    </div>
  );
}

function tagHeatColor(count: number, maxCount: number): string {
  const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 1;
  const r = Math.round(214 - ratio * (214 - 26));
  const g = Math.round(237 - ratio * (237 - 71));
  const b = Math.round(217 - ratio * (217 - 28));
  return `rgb(${r},${g},${b})`;
}

const TOP_TAG_COUNT = 5;

function TagsSection({
  tags, selectedTag, onSelectTag,
}: {
  tags: [string, number][];
  selectedTag: string | null;
  onSelectTag: (tag: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const maxCount = tags[0]?.[1] ?? 1;

  const filtered = search.trim()
    ? tags.filter(([tag]) => tag.toLowerCase().includes(search.toLowerCase()))
    : tags.slice(0, TOP_TAG_COUNT);

  const isSearching = !!search.trim();

  return (
    <div
      style={{
        borderTop: `1px solid ${C.border}`,
        padding: collapsed ? "10px 10px" : "10px 10px 12px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: "flex", alignItems: "center", padding: collapsed ? "0 4px" : "0 4px 7px",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.09em", color: C.muted, flex: 1 }}>
          Tags{tags.length > 0 && <span style={{ marginLeft: 5 }}>[{search.trim() ? filtered.length : tags.length}]</span>}
        </span>
        <ChevronDown size={13} style={{ color: C.muted, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s", flexShrink: 0, marginRight: -3 }} />
      </div>

      {!collapsed && tags.length === 0 && (
        <p style={{ fontSize: 12, color: C.muted, padding: "0 8px", fontStyle: "italic", margin: 0 }}>No tags yet</p>
      )}

      {!collapsed && tags.length > 0 && (
        <>
          <div style={{ padding: "0 4px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, padding: "4px 4px", fontStyle: "italic", margin: 0 }}>
                No matching tags
              </p>
            ) : (
              filtered.map(([tag, count]) => {
                const barPct = Math.max(8, Math.round((count / maxCount) * 100));
                const isSel = selectedTag === tag;
                return (
                  <div
                    key={tag}
                    onClick={() => onSelectTag(tag)}
                    title={isSel ? "Clear highlight" : `Highlight cards tagged “${tag}”`}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 6px", borderRadius: 6, cursor: "pointer",
                      background: isSel ? "color-mix(in oklab, var(--forest) 14%, transparent)" : "transparent",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "color-mix(in oklab, var(--forest) 6%, transparent)"; }}
                    onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 60, fontSize: 12, color: isSel ? "var(--forest)" : C.text, fontWeight: isSel ? 700 : 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      flexShrink: 0, textAlign: "right",
                    }}>
                      {tag}
                    </span>
                    <div style={{
                      flex: 1, height: 8, background: C.hover, borderRadius: 3,
                      overflow: "hidden", position: "relative",
                    }}>
                      <div style={{
                        width: `${barPct}%`,
                        height: "100%",
                        background: tagHeatColor(count, maxCount),
                        borderRadius: 3,
                        transition: "width 0.25s ease",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontFamily: "var(--mono)", color: isSel ? "var(--forest)" : C.muted,
                      minWidth: 18, textAlign: "right", flexShrink: 0,
                    }}>
                      {count}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop: 4 }}>
            <SearchField
              size="sm"
              value={search}
              onChange={setSearch}
              placeholder="Filter tags…"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {!isSearching && tags.length > TOP_TAG_COUNT && (
            <span style={{ fontSize: 10, color: C.muted, padding: "4px 4px 0", fontStyle: "italic", textAlign: "center" }}>
              showing top {TOP_TAG_COUNT} of {tags.length}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ProjectsPanel({
  spaces,
  allProjects,
  activeProjectId,
  firstSpaceId,
  searchNode,
  onToggleSidebar,
  onOpenSettings,
  activeTopicId,
  onActivateTopic,
  onOpenTopic,
  onCreateTopic,
  onDuplicateTopic,
  onDeleteTopic,
  onSelectProject,
  onAddProject,
  onAddSpace,
  onRenameProject,
  onDeleteProject,
  onDuplicateProject,
  onChangeProjectColor,
  onExportProject,
  onDeleteSpace,
  onRenameSpace,
  onMoveProject,
  topics,
  isFiltering,
  topicResults,
  onOpenTopicResult,
}: {
  spaces: Space[];
  allProjects: { id: string; name: string; spaceId: string; spaceName: string; color: string }[];
  activeProjectId: string | null;
  firstSpaceId: string;
  searchNode: React.ReactNode;
  onToggleSidebar?: () => void;
  onOpenSettings: () => void;
  activeTopicId: string | null;
  onActivateTopic: (id: string) => void;
  onOpenTopic: (id: string) => void;
  onCreateTopic: (projectId: string) => void;
  onDuplicateTopic: (id: string) => void;
  onDeleteTopic: (id: string) => void;
  onSelectProject: (id: string) => void;
  onAddProject: (spaceId: string, name: string) => void;
  onAddSpace: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onChangeProjectColor: (id: string, color: string) => void;
  onExportProject: (id: string) => void;
  onDeleteSpace: (id: string) => void;
  onRenameSpace: (id: string, name: string) => void;
  onMoveProject: (projectId: string, targetSpaceId: string) => void;
  topics: Topic[];
  isFiltering: boolean;
  topicResults: { topic: Topic; projectName: string }[];
  onOpenTopicResult: (topicId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null);
  const [addingName, setAddingName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addBtnHovered, setAddBtnHovered] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [isAddingSpace, setIsAddingSpace] = useState(false);
  const [addingSpaceName, setAddingSpaceName] = useState("");
  const addSpaceInputRef = useRef<HTMLInputElement>(null);
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null);
  const spaceMenuRef = useRef<HTMLDivElement>(null);
  const [renamingSpaceId, setRenamingSpaceId] = useState<string | null>(null);
  const [renameSpaceVal, setRenameSpaceVal] = useState("");
  const renameSpaceRef = useRef<HTMLInputElement>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [openTopicIds, setOpenTopicIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (isAdding) addInputRef.current?.focus(); }, [isAdding]);
  useEffect(() => { if (isAddingSpace) addSpaceInputRef.current?.focus(); }, [isAddingSpace]);
  useEffect(() => { if (renamingSpaceId) { const el = renameSpaceRef.current; el?.focus(); el?.select(); } }, [renamingSpaceId]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        addMenuRef.current && !addMenuRef.current.contains(target) &&
        addBtnRef.current && !addBtnRef.current.contains(target)
      ) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addMenuOpen]);

  useEffect(() => {
    if (!spaceMenuId) return;
    const handler = (e: MouseEvent) => {
      if (spaceMenuRef.current && !spaceMenuRef.current.contains(e.target as Node)) setSpaceMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [spaceMenuId]);

  const submitAdd = () => {
    const name = addingName.trim();
    if (name) {
      const targetSpaceId =
        spaces.find((s) => s.projects.some((p) => p.id === activeProjectId))?.id ?? firstSpaceId;
      onAddProject(targetSpaceId, name);
    }
    setIsAdding(false);
    setAddingName("");
  };

  const submitAddSpace = () => {
    const name = addingSpaceName.trim();
    if (name) onAddSpace(name);
    setIsAddingSpace(false);
    setAddingSpaceName("");
  };

  const submitRenameSpace = () => {
    const name = renameSpaceVal.trim();
    if (name && renamingSpaceId) onRenameSpace(renamingSpaceId, name);
    setRenamingSpaceId(null);
    setRenameSpaceVal("");
  };

  const grouped = isFiltering
    ? [{ spaceId: "", spaceName: "", projects: allProjects }]
    : spaces.map((s) => ({
        spaceId: s.id,
        spaceName: s.name,
        projects: allProjects.filter((p) => p.spaceId === s.id),
      }));

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: C.sidebar }}>
      <div style={{ padding: "18px 10px 0", flexShrink: 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
        <span style={{
          flex: 1, minWidth: 0, fontFamily: "var(--serif)", fontWeight: 400,
          fontSize: 38, lineHeight: 1.15, letterSpacing: "-0.035em", color: C.text,
          whiteSpace: "nowrap",
        }}>
          Projects
        </span>
        <div>
          <button
            ref={addBtnRef}
            onClick={() => setAddMenuOpen((v) => !v)}
            title="New…"
            style={{
              ...headerBtnStyle(),
              background: addBtnHovered || addMenuOpen ? C.hover : "transparent",
              color: addBtnHovered || addMenuOpen ? C.text : C.muted,
              transform: addBtnHovered || addMenuOpen ? "rotate(20deg)" : "rotate(0deg)",
              transition: "color 0.14s ease, transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), background 0.16s ease",
            }}
            onMouseEnter={() => setAddBtnHovered(true)}
            onMouseLeave={() => setAddBtnHovered(false)}
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
        <SettingsButton onClick={onOpenSettings} />
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            style={headerBtnStyle()}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = C.hover; el.style.color = C.text; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = C.muted; }}
          >
            <PanelLeftClose size={16} strokeWidth={2} />
          </button>
        )}

        {addMenuOpen && (
          <div ref={addMenuRef} style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 102,
            background: "#ffffff", border: `1px solid ${C.border}`,
            borderRadius: 11, padding: 5, minWidth: 198,
            boxShadow: "0 6px 20px rgba(20,29,21,0.12)",
            animation: "popIn 0.1s ease",
          }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); setIsAdding(true); setAddingName(""); setAddMenuOpen(false); }}
              style={addMenuItemStyle()}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <LayersPlus size={18} style={{ color: C.muted, flexShrink: 0, marginTop: 1 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.25 }}>Project</span>
                <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.25 }}>A canvas of topics &amp; decisions</span>
              </span>
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); setIsAddingSpace(true); setAddingSpaceName(""); setAddMenuOpen(false); }}
              style={addMenuItemStyle()}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <FolderPlus size={18} style={{ color: C.muted, flexShrink: 0, marginTop: 1 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.25 }}>Workspace</span>
                <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.25 }}>A group of related projects</span>
              </span>
            </button>
          </div>
        )}
        </div>

        <div style={{ marginTop: 10 }}>
          {searchNode}
        </div>
        <div style={{ height: 1, background: C.border, margin: "12px 4px 0" }} />
      </div>

      <div className="sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 10px 12px", minHeight: 0 }}>
        <>
          {isFiltering && allProjects.length > 0 && (
            <div style={searchSectionLabel()}>
              Projects<span style={{ marginLeft: 6, color: "#b3b7be", fontWeight: 600 }}>{allProjects.length}</span>
            </div>
          )}
          {grouped.map((group, gi) => (
            <div
              key={group.spaceId || "flat"}
              style={{ marginTop: gi === 0 ? 0 : 12 }}
              onDragOver={(e) => {
                if (!draggingId || !group.spaceId) return;
                e.preventDefault();
                setDragOverSpaceId(group.spaceId);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSpaceId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId && group.spaceId) onMoveProject(draggingId, group.spaceId);
                setDraggingId(null);
                setDragOverSpaceId(null);
              }}
            >
              {!isFiltering && group.spaceName && (
                <div style={{ position: "relative" }}>
                  <div style={{
                    display: "flex", alignItems: "center", padding: "9px 6px 6px", gap: 4,
                    borderRadius: 7,
                    background: dragOverSpaceId === group.spaceId
                      ? "color-mix(in oklab, var(--forest-soft) 55%, transparent)"
                      : "transparent",
                    outline: dragOverSpaceId === group.spaceId ? "1px dashed var(--forest)" : "1px dashed transparent",
                    outlineOffset: -1,
                    transition: "background 0.12s",
                  }}>
                    {renamingSpaceId === group.spaceId ? (
                      <input
                        ref={renameSpaceRef}
                        value={renameSpaceVal}
                        onChange={(e) => setRenameSpaceVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRenameSpace();
                          if (e.key === "Escape") { setRenamingSpaceId(null); }
                          e.stopPropagation();
                        }}
                        onBlur={submitRenameSpace}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1, minWidth: 0,
                          background: "transparent", border: "none", outline: "none",
                          padding: 0, margin: 0,
                          fontSize: 11, fontFamily: "var(--sans)", fontWeight: 600,
                          letterSpacing: "0.01em", color: C.muted,
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, fontFamily: "var(--sans)", fontWeight: 600, letterSpacing: "0.01em", color: C.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {group.spaceName}{group.projects.length > 0 && <span style={{ marginLeft: 5 }}>[{group.projects.length}]</span>}
                      </span>
                    )}
                    {renamingSpaceId !== group.spaceId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSpaceMenuId(spaceMenuId === group.spaceId ? null : group.spaceId); }}
                        style={{ ...iconBtn(), width: 20, height: 20, borderRadius: 6 }}
                        onMouseEnter={onTreeIconEnter}
                        onMouseLeave={onTreeIconLeave}
                      >
                        <MoreHorizontal size={14} style={{ color: C.muted }} />
                      </button>
                    )}
                  </div>
                  {spaceMenuId === group.spaceId && (
                    <div
                      ref={spaceMenuRef}
                      style={{
                        position: "absolute", top: "100%", right: 8, zIndex: 103,
                        background: "#ffffff", border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: 4, minWidth: 160,
                        boxShadow: "0 6px 20px rgba(20,29,21,0.12)",
                        animation: "popIn 0.1s ease",
                      }}
                    >
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setRenamingSpaceId(group.spaceId); setRenameSpaceVal(group.spaceName); setSpaceMenuId(null); }}
                        style={menuItemStyle()}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <Pencil size={menuIconSize} strokeWidth={2} style={{ color: C.muted }} />
                        <span>Rename</span>
                      </button>
                      <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
                      <button
                        onMouseDown={(e) => { e.preventDefault(); onDeleteSpace(group.spaceId); setSpaceMenuId(null); }}
                        style={{ ...menuItemStyle(), color: "var(--rose)" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <Trash2 size={menuIconSize} strokeWidth={2} style={{ color: "var(--rose)" }} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {group.projects.map((proj) => {
                const isActive = proj.id === activeProjectId;
                const showTree = isActive && !isFiltering && topics.length > 0;
                return (
                <div key={proj.id}>
                  <ProjectRow
                    project={proj}
                    isActive={isActive}
                    count={isActive ? topics.length : 0}
                    expandable={showTree}
                    treeOpen={treeOpen}
                    onToggleTree={() => setTreeOpen((v) => !v)}
                    onSelect={() => onSelectProject(proj.id)}
                    onRename={(name) => onRenameProject(proj.id, name)}
                    onDelete={() => onDeleteProject(proj.id)}
                    onDuplicate={() => onDuplicateProject(proj.id)}
                    onCreateTopic={() => onCreateTopic(proj.id)}
                    onExport={() => onExportProject(proj.id)}
                    onColorChange={(color) => onChangeProjectColor(proj.id, color)}
                    isDragging={draggingId === proj.id}
                    onDragStart={() => setDraggingId(proj.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverSpaceId(null); }}
                  />
                  {showTree && treeOpen && (
                    <TopicTree
                      topics={topics}
                      activeTopicId={activeTopicId}
                      openTopicIds={openTopicIds}
                      onToggleTopic={(id) =>
                        setOpenTopicIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          return next;
                        })
                      }
                      onActivateTopic={onActivateTopic}
                      onOpenTopic={onOpenTopic}
                      onDuplicateTopic={onDuplicateTopic}
                      onDeleteTopic={onDeleteTopic}
                    />
                  )}
                </div>
                );
              })}
              {!isFiltering && group.spaceName && group.projects.length === 0 && (
                <div style={{
                  fontSize: 12, color: C.muted, fontStyle: "italic",
                  padding: "2px 8px 6px", opacity: 0.65,
                }}>
                  No projects yet
                </div>
              )}
            </div>
          ))}

          {isFiltering && topicResults.length > 0 && (
            <div style={{ marginTop: allProjects.length > 0 ? 14 : 0 }}>
              <div style={searchSectionLabel()}>
                Topics<span style={{ marginLeft: 6, color: "#b3b7be", fontWeight: 600 }}>{topicResults.length}</span>
              </div>
              {topicResults.map((r) => (
                <TopicResultRow
                  key={r.topic.id}
                  topic={r.topic}
                  projectName={r.projectName}
                  onClick={() => onOpenTopicResult(r.topic.id)}
                />
              ))}
            </div>
          )}

          {isFiltering && allProjects.length === 0 && topicResults.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.muted, fontStyle: "italic", padding: "10px 8px", opacity: 0.75 }}>
              No projects or topics found.
            </div>
          )}

          {isAdding && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px" }}>
              <span style={{ paddingLeft: 4, display: "flex", alignItems: "center" }}>
                <span style={colorChipStyle(PROJECT_COLORS[0], 13)} />
              </span>
              <input
                ref={addInputRef}
                value={addingName}
                maxLength={50}
                onChange={(e) => setAddingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                  if (e.key === "Escape") { setIsAdding(false); setAddingName(""); }
                }}
                placeholder="Name this project…"
                style={{
                  flex: 1, minWidth: 0, background: "var(--paper)", border: `1px solid ${C.border}`,
                  borderRadius: 7, padding: "6px 9px", fontSize: 13,
                  color: C.text, fontFamily: "inherit", outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--forest)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
              />
              <button
                onClick={submitAdd}
                title="Create project"
                style={confirmBtnStyle()}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "color-mix(in oklab, var(--forest) 84%, white)"; el.style.transform = "scale(1.06)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--forest)"; el.style.transform = "scale(1)"; }}
              >
                <Check size={14} strokeWidth={2.5} style={{ color: "#EEF4EA" }} />
              </button>
            </div>
          )}

          {isAddingSpace && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 4px 4px" }}>
              <span style={{ paddingLeft: 4, display: "flex", alignItems: "center" }}>
                <FolderPlus size={14} style={{ color: C.muted }} />
              </span>
              <input
                ref={addSpaceInputRef}
                value={addingSpaceName}
                onChange={(e) => setAddingSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAddSpace();
                  if (e.key === "Escape") { setIsAddingSpace(false); setAddingSpaceName(""); }
                }}
                placeholder="Name this workspace…"
                style={{
                  flex: 1, minWidth: 0, background: "var(--paper)", border: `1px solid ${C.border}`,
                  borderRadius: 7, padding: "6px 9px", fontSize: 13,
                  color: C.text, fontFamily: "inherit", outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--forest)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
              />
              <button
                onClick={submitAddSpace}
                title="Create workspace"
                style={confirmBtnStyle()}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "color-mix(in oklab, var(--forest) 84%, white)"; el.style.transform = "scale(1.06)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--forest)"; el.style.transform = "scale(1)"; }}
              >
                <Check size={14} strokeWidth={2.5} style={{ color: "#EEF4EA" }} />
              </button>
            </div>
          )}
        </>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  isActive,
  count,
  expandable,
  treeOpen,
  onToggleTree,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
  onCreateTopic,
  onExport,
  onColorChange,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  project: { id: string; name: string; color: string };
  isActive: boolean;
  count: number;
  expandable?: boolean;
  treeOpen?: boolean;
  onToggleTree?: () => void;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCreateTopic: () => void;
  onExport: () => void;
  onColorChange: (color: string) => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(project.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      const el = renameRef.current;
      el?.focus();
      el?.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        colorRef.current && !colorRef.current.contains(target) &&
        colorBtnRef.current && !colorBtnRef.current.contains(target)
      ) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colorPickerOpen]);

  const submitRename = () => {
    const name = renameVal.trim();
    if (name && name !== project.name) onRename(name);
    else setRenameVal(project.name);
    setRenaming(false);
  };

  const tone = projectTone(project.color);
  const rowBg = isActive
    ? `color-mix(in oklab, ${tone.soft} 88%, var(--paper))`
    : hovered
      ? `color-mix(in oklab, ${tone.soft} 42%, transparent)`
      : "transparent";
  const nameColor = isActive ? tone.deep : "#3a3e4a";

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      style={{ position: "relative", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.12s" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onClick={() => { if (!renaming) onSelect(); }}
        onContextMenu={(e) => { if (!renaming) { e.preventDefault(); setColorPickerOpen(false); setMenuOpen(true); } }}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "6px 8px", borderRadius: 8,
          cursor: hovered && !renaming ? "grab" : "pointer",
          background: rowBg,
          transition: "background 0.1s",
        }}
      >
        {expandable ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleTree?.(); }}
            title={treeOpen ? "Hide topics" : "Show topics"}
            style={{
              width: 14, height: 20, flexShrink: 0, padding: 0, border: "none",
              background: "transparent", cursor: "pointer", color: nameColor, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.13s ease",
            }}
            onMouseEnter={onTreeIconEnter}
            onMouseLeave={onTreeIconLeave}
          >
            <ChevronDown size={14} style={{ transform: treeOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.16s ease" }} />
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        <button
          ref={colorBtnRef}
          onClick={(e) => { e.stopPropagation(); setColorPickerOpen((v) => !v); }}
          title="Change color"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, border: "none", background: "transparent",
            cursor: "pointer", padding: 0, flexShrink: 0, borderRadius: 6,
            transition: "background 0.13s ease",
          }}
          onMouseEnter={onTreeIconEnter}
          onMouseLeave={onTreeIconLeave}
        >
          <span style={colorChipStyle(tone.base, 13)} />
        </button>

        {renaming ? (
          <input
            ref={renameRef}
            value={renameVal}
            maxLength={50}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") { setRenameVal(project.name); setRenaming(false); }
              e.stopPropagation();
            }}
            onBlur={submitRename}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0,
              background: "transparent", border: "none", outline: "none",
              padding: 0, margin: 0,
              fontSize: 13.5, fontFamily: "inherit",
              fontWeight: isActive ? 600 : 400,
              color: nameColor,
            }}
          />
        ) : (
          <span
            style={{
              flex: 1, fontSize: 13.5, color: nameColor,
              fontWeight: isActive ? 600 : 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {project.name}
          </span>
        )}

        {!renaming && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            {isActive && count > 0 && (
              <span
                style={{
                  fontSize: 11, fontFamily: "var(--mono)", color: tone.deep,
                  opacity: hovered ? 0 : 0.7, transition: "opacity 0.1s",
                  position: "absolute", right: 12, pointerEvents: "none",
                }}
              >
                {count}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameVal(project.name); }}
              style={{
                ...actionBtn(),
                opacity: hovered ? 1 : 0,
                pointerEvents: hovered ? "auto" : "none",
              }}
              title="Rename"
              onMouseEnter={onTreeIconEnter}
              onMouseLeave={onTreeIconLeave}
            >
              <Pencil size={14} style={{ color: C.muted }} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              style={{
                ...actionBtn(),
                opacity: hovered ? 1 : 0,
                pointerEvents: hovered ? "auto" : "none",
              }}
              title="More"
              onMouseEnter={onTreeIconEnter}
              onMouseLeave={onTreeIconLeave}
            >
              <MoreHorizontal size={14} style={{ color: C.muted }} />
            </button>
          </div>
        )}
      </div>

      {colorPickerOpen && (
        <div
          ref={colorRef}
          style={{
            position: "absolute", top: "calc(100% + 2px)", left: 8, zIndex: 101,
            background: "#ffffff", border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "9px 10px",
            boxShadow: "0 6px 20px rgba(20,29,21,0.12)",
            display: "grid", gridTemplateColumns: "repeat(4, 22px)", gap: 9,
          }}
        >
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              onMouseDown={(e) => {
                e.preventDefault();
                onColorChange(color);
                setColorPickerOpen(false);
              }}
              style={{
                width: 22, height: 22, borderRadius: 6,
                background: color,
                boxShadow: project.color === color
                  ? `0 0 0 2px var(--paper), 0 0 0 4px ${color}`
                  : "inset 0 0 0 1px rgba(20,29,21,0.10)",
                border: "none",
                cursor: "pointer",
                transform: "scale(1)",
                transformOrigin: "center",
                willChange: "transform",
                transition: "transform 0.16s cubic-bezier(0.22, 1, 0.36, 1)",
                flexShrink: 0,
                outline: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.transform = "scale(1.16)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.transform = "scale(1)"}
            />
          ))}
        </div>
      )}

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute", top: "calc(100% + 2px)", right: 4, zIndex: 100,
            background: "#ffffff", border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 4, minWidth: 180,
            boxShadow: "0 6px 20px rgba(20,29,21,0.12)",
            animation: "popIn 0.1s ease",
          }}
        >
          {[
            { icon: Plus, label: "New topic", action: () => { onCreateTopic(); setMenuOpen(false); } },
            { icon: Pencil, label: "Rename", action: () => { setRenaming(true); setRenameVal(project.name); setMenuOpen(false); } },
            { icon: Copy, label: "Duplicate", action: () => { onDuplicate(); setMenuOpen(false); } },
            { icon: FileDown, label: "Save as Markdown", action: () => { onExport(); setMenuOpen(false); } },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onMouseDown={(e) => { e.preventDefault(); action(); }}
              style={menuItemStyle()}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <Icon size={menuIconSize} strokeWidth={2} style={{ color: C.muted }} />
              <span>{label}</span>
            </button>
          ))}
          <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
          <button
            onMouseDown={(e) => { e.preventDefault(); onDelete(); setMenuOpen(false); }}
            style={{ ...menuItemStyle(), color: "var(--rose)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <Trash2 size={menuIconSize} strokeWidth={2} style={{ color: "var(--rose)" }} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

function headerBtnStyle(): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 6, flexShrink: 0, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "1px solid transparent",
    color: C.muted,
    transition: "color 0.14s ease, background 0.16s ease",
  };
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Settings"
      aria-label="Settings"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...headerBtnStyle(), background: hovered ? C.hover : "transparent", color: hovered ? C.text : C.muted }}
    >
      <Settings size={16} strokeWidth={2} />
    </button>
  );
}

function TopicTree({
  topics, activeTopicId, openTopicIds, onToggleTopic, onActivateTopic,
  onOpenTopic, onDuplicateTopic, onDeleteTopic,
}: {
  topics: Topic[];
  activeTopicId: string | null;
  openTopicIds: Set<string>;
  onToggleTopic: (id: string) => void;
  onActivateTopic: (id: string) => void;
  onOpenTopic: (id: string) => void;
  onDuplicateTopic: (id: string) => void;
  onDeleteTopic: (id: string) => void;
}) {
  return (
    <div style={{ marginLeft: 18, paddingLeft: 10, borderLeft: `1px solid ${C.border}`, marginTop: 1 }}>
      {topics.map((t) => {
        const tone = TONE_META[t.tone];
        const open = openTopicIds.has(t.id);
        const hasDecisions = t.decisions.length > 0;
        return (
          <div key={t.id}>
            <TopicTreeRow
              topic={t}
              tone={tone}
              isActive={t.id === activeTopicId}
              open={open}
              hasDecisions={hasDecisions}
              onClick={() => { onActivateTopic(t.id); if (hasDecisions) onToggleTopic(t.id); }}
              onOpen={() => onOpenTopic(t.id)}
              onDuplicate={() => onDuplicateTopic(t.id)}
              onDelete={() => onDeleteTopic(t.id)}
            />
            {open && hasDecisions && (
              <div style={{ marginLeft: 15, paddingLeft: 10, borderLeft: `1px solid ${C.border}`, paddingBottom: 2 }}>
                {t.decisions.map((d, i) => (
                  <div
                    key={d.id}
                    onClick={() => onActivateTopic(t.id)}
                    style={{
                      display: "flex", alignItems: "baseline", gap: 7,
                      padding: "3px 6px", borderRadius: 5, cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: C.muted, opacity: 0.65, flexShrink: 0 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 12, color: "#585c66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.title || "Untitled"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TopicTreeRow({
  topic, tone, isActive, open, hasDecisions, onClick, onOpen, onDuplicate, onDelete,
}: {
  topic: Topic;
  tone: { base: string; soft: string; deep: string };
  isActive: boolean;
  open: boolean;
  hasDecisions: boolean;
  onClick: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const showActions = hovered || menuOpen;
  const bg = isActive
    ? `color-mix(in oklab, ${tone.soft} 80%, var(--paper))`
    : showActions
      ? `color-mix(in oklab, ${tone.soft} 38%, transparent)`
      : "transparent";

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 6px", borderRadius: 6, cursor: "pointer",
        background: bg, transition: "background 0.1s",
      }}
    >
      <span style={{ width: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? tone.deep : C.muted }}>
        {hasDecisions ? (
          <ChevronDown size={12} style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.16s ease" }} />
        ) : (
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.muted, opacity: 0.5 }} />
        )}
      </span>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: tone.base, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 12.5, color: isActive ? tone.deep : "#3a3e4a",
        fontWeight: isActive ? 600 : 400,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {topic.title || "Untitled"}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        {hasDecisions && (
          <span style={{
            fontSize: 10, fontFamily: "var(--mono)", color: isActive ? tone.deep : C.muted,
            opacity: showActions ? 0 : 0.6, transition: "opacity 0.1s",
            position: "absolute", right: 9, pointerEvents: "none",
          }}>
            {topic.decisions.length}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          title="Edit topic"
          style={{ ...treeActionBtn(), opacity: showActions ? 1 : 0, pointerEvents: showActions ? "auto" : "none" }}
          onMouseEnter={onTreeIconEnter}
          onMouseLeave={onTreeIconLeave}
        >
          <Maximize2 size={13} style={{ color: C.muted }} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          title="More"
          style={{ ...treeActionBtn(), opacity: showActions ? 1 : 0, pointerEvents: showActions ? "auto" : "none" }}
          onMouseEnter={onTreeIconEnter}
          onMouseLeave={onTreeIconLeave}
        >
          <MoreHorizontal size={14} style={{ color: C.muted }} />
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 2px)", right: 4, zIndex: 104,
            background: "#ffffff", border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 4, minWidth: 150,
            boxShadow: "0 6px 20px rgba(20,29,21,0.12)",
            animation: "popIn 0.1s ease",
          }}
        >
          <button
            onMouseDown={(e) => { e.preventDefault(); onOpen(); setMenuOpen(false); }}
            style={menuItemStyle()}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <Pencil size={menuIconSize} strokeWidth={2} style={{ color: C.muted }} />
            <span>Edit topic</span>
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onDuplicate(); setMenuOpen(false); }}
            style={menuItemStyle()}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <Copy size={menuIconSize} strokeWidth={2} style={{ color: C.muted }} />
            <span>Duplicate</span>
          </button>
          <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
          <button
            onMouseDown={(e) => { e.preventDefault(); onDelete(); setMenuOpen(false); }}
            style={{ ...menuItemStyle(), color: "var(--rose)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <Trash2 size={menuIconSize} strokeWidth={2} style={{ color: "var(--rose)" }} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

function treeActionBtn(): React.CSSProperties {
  return {
    width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", background: "transparent", cursor: "pointer", borderRadius: 6,
    transition: "background 0.13s ease, opacity 0.1s", flexShrink: 0,
  };
}

function searchSectionLabel(): React.CSSProperties {
  return {
    display: "flex", alignItems: "baseline",
    padding: "2px 6px 7px",
    fontSize: 10.5, fontFamily: "var(--sans)", fontWeight: 700,
    letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted,
  };
}

function TopicResultRow({
  topic, projectName, onClick,
}: {
  topic: Topic;
  projectName: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const tone = TONE_META[topic.tone];
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 8px", borderRadius: 7, cursor: "pointer",
        background: hovered ? `color-mix(in oklab, ${tone.soft} 40%, transparent)` : "transparent",
        transition: "background 0.1s",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: tone.base, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 13, color: "#3a3e4a", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topic.title || "Untitled"}
        </span>
        <span style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {projectName}
        </span>
      </span>
    </div>
  );
}

function iconBtn(): React.CSSProperties {
  return {
    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", background: "transparent", cursor: "pointer", borderRadius: 5,
    transition: "background 0.12s", flexShrink: 0,
  };
}

function actionBtn(): React.CSSProperties {
  return {
    width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", background: "transparent", cursor: "pointer", borderRadius: 6,
    transition: "background 0.13s ease, opacity 0.1s",
  };
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 9,
    width: "100%", padding: "7px 10px", borderRadius: 7,
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 13, color: C.text, textAlign: "left", fontFamily: "inherit",
    transition: "background 0.1s",
  };
}

function confirmBtnStyle(): React.CSSProperties {
  return {
    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", borderRadius: 7, background: "var(--forest)", cursor: "pointer",
    flexShrink: 0, transition: "background 0.14s ease, transform 0.14s cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

function addMenuItemStyle(): React.CSSProperties {
  return {
    display: "flex", alignItems: "flex-start", gap: 11,
    width: "100%", padding: "8px 10px", borderRadius: 8,
    background: "transparent", border: "none", cursor: "pointer",
    textAlign: "left", fontFamily: "inherit",
    transition: "background 0.1s",
  };
}
