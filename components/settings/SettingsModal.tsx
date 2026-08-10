"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Settings, Check, AlertTriangle, Loader2, RefreshCw, ChevronDown, Trash2,
} from "lucide-react";
import {
  DEFAULT_CLAUDE_CLI_COMMAND, DEFAULT_OLLAMA_ENDPOINT, modelMeta,
  CLAUDE_MODEL_ALIASES, claudeModelLabel,
} from "@/lib/types";
import type {
  AppSettings, AiSettingsInput, OllamaModel, AiProvider,
} from "@/lib/types";
import { listOllamaModels, checkClaudeModel, type ClaudeModelCheck } from "@/app/actions/config";
import { resetEnvironment } from "@/app/actions/storage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HooksSection } from "./HooksSection";

interface Props {
  settings: AppSettings;
  onApplyAiSettings: (next: AiSettingsInput) => Promise<void>;
  onHooksSaved: () => void;
  onClose: () => void;
}

const FOREST = "var(--forest)";
const ROSE = "var(--rose)";

type ConnStatus = "idle" | "checking" | "online" | "offline";

export function SettingsModal({ settings, onApplyAiSettings, onHooksSaved, onClose }: Props) {
  const [aiProvider, setAiProvider] = useState<AiProvider>(settings.aiProvider);
  const [claudeCliCommand, setClaudeCliCommand] = useState(
    settings.claudeCliCommand || DEFAULT_CLAUDE_CLI_COMMAND
  );
  const [claudeModel, setClaudeModel] = useState(settings.claudeModel);
  const [claudeVersions, setClaudeVersions] = useState(settings.claudeModelVersions);
  const [claudeChecking, setClaudeChecking] = useState(false);
  const [claudeCheck, setClaudeCheck] = useState<ClaudeModelCheck | null>(null);

  const changeClaudeModel = useCallback((v: string) => {
    setClaudeModel(v);
    setClaudeCheck(null);
  }, []);

  const checkClaude = useCallback(async () => {
    setClaudeChecking(true);
    const res = await checkClaudeModel(claudeModel);
    setClaudeCheck(res);
    const key = claudeModel.trim();
    if (res.ok && (CLAUDE_MODEL_ALIASES as readonly string[]).includes(key)) {
      setClaudeVersions((v) => ({ ...v, [key]: res.resolved }));
    }
    setClaudeChecking(false);
  }, [claudeModel]);

  const savedIsDefault = settings.ollamaEndpoint.trim() === DEFAULT_OLLAMA_ENDPOINT;
  const [endpointMode, setEndpointMode] = useState<"default" | "custom">(
    savedIsDefault ? "default" : "custom"
  );
  const [customEndpoint, setCustomEndpoint] = useState(
    savedIsDefault ? "" : settings.ollamaEndpoint
  );
  const ollamaEndpoint =
    endpointMode === "default" ? DEFAULT_OLLAMA_ENDPOINT : customEndpoint.trim();
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnStatus>("checking");
  const [reloadKey, setReloadKey] = useState(0);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (aiProvider !== "ollama") {
      setConn("idle");
      setModels([]);
      setModelsError(null);
      setLoadingModels(false);
      return;
    }
    if (!ollamaEndpoint) {
      setConn("idle");
      setModels([]);
      setModelsError(null);
      setLoadingModels(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingModels(true);
      setConn("checking");
      setModelsError(null);
      const res = await listOllamaModels(ollamaEndpoint);
      if (cancelled) return;
      if (res.ok) {
        setConn("online");
        setModels(res.models);
        setModelsError(
          res.models.length
            ? null
            : "No models installed. Pull one first, e.g. ollama pull llama3.2."
        );
      } else {
        setConn("offline");
        setModels([]);
        setModelsError(null);
      }
      setLoadingModels(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [aiProvider, ollamaEndpoint, reloadKey]);

  const dirtyAi =
    aiProvider !== settings.aiProvider ||
    ollamaEndpoint !== settings.ollamaEndpoint ||
    ollamaModel !== settings.ollamaModel ||
    claudeCliCommand.trim() !== settings.claudeCliCommand.trim() ||
    claudeModel !== settings.claudeModel;

  const saveAi = async () => {
    setAiSaving(true);
    setAiError(null);
    try {
      const input: AiSettingsInput = {
        aiProvider,
        ollamaEndpoint,
        ollamaModel,
        claudeCliCommand: claudeCliCommand.trim() || DEFAULT_CLAUDE_CLI_COMMAND,
        claudeModel,
      };
      await onApplyAiSettings(input);
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2200);
    } catch {
      setAiError("Could not save. Please try again.");
    } finally {
      setAiSaving(false);
    }
  };

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panelStyle}>
        <style>{`@keyframes millSpin { to { transform: rotate(360deg); } } @keyframes millMenuIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <Settings size={18} strokeWidth={2} style={{ color: "var(--ink)", flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              Settings
            </span>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={closeBtn}
            aria-label="Close settings"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--paper-3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-4)";
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={bodyStyle}>
          <section style={sectionStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Provider">
                <ProviderToggle value={aiProvider} onChange={setAiProvider} />
              </Field>

              {aiProvider === "ollama" ? (
                <>
                  <Field label="Endpoint" aside={<ConnStatus status={conn} />}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <EndpointToggle mode={endpointMode} onMode={setEndpointMode} />
                      {endpointMode === "default" ? (
                        <p style={endpointNote}>
                          Using <span style={endpointNoteUrl}>{DEFAULT_OLLAMA_ENDPOINT}</span>
                        </p>
                      ) : (
                        <FocusInput
                          value={customEndpoint}
                          onChange={setCustomEndpoint}
                          mono
                          autoFocus
                          placeholder={DEFAULT_OLLAMA_ENDPOINT}
                        />
                      )}
                    </div>
                  </Field>
                  <Field label="Model">
                    <ModelSelect
                      value={ollamaModel}
                      onChange={setOllamaModel}
                      models={models}
                      loading={loadingModels}
                      error={modelsError}
                      conn={conn}
                      onRefresh={() => setReloadKey((k) => k + 1)}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Model">
                    <ClaudeModelPicker
                      value={claudeModel}
                      onChange={changeClaudeModel}
                      versions={claudeVersions}
                      onCheck={checkClaude}
                      checking={claudeChecking}
                      check={claudeCheck}
                    />
                  </Field>
                  <Field label="Command">
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <FocusInput
                        value={claudeCliCommand}
                        onChange={setClaudeCliCommand}
                        mono
                        placeholder={DEFAULT_CLAUDE_CLI_COMMAND}
                      />
                      <p style={{ ...helpText, margin: 0 }}>
                        Mill pipes the prompt to this command on stdin and parses
                        JSON from stdout, passing the model above as{" "}
                        <code style={inlineCode}>--model</code>. You must have{" "}
                        <code style={inlineCode}>claude</code> installed and logged
                        into your own subscription.
                      </p>
                    </div>
                  </Field>
                </>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
              <PrimaryButton
                disabled={
                  aiSaving ||
                  !dirtyAi ||
                  (aiProvider === "ollama" && endpointMode === "custom" && !customEndpoint.trim()) ||
                  (aiProvider === "claude_cli" && !claudeCliCommand.trim())
                }
                onClick={saveAi}
              >
                {aiSaving ? <Loader2 size={13} style={spin} /> : null}
                {aiSaving ? "Saving" : "Save changes"}
              </PrimaryButton>
              {aiSaved && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: FOREST, fontWeight: 500 }}>
                  <Check size={14} /> Saved
                </span>
              )}
              {aiError && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: ROSE, fontWeight: 500 }}>
                  <AlertTriangle size={14} /> {aiError}
                </span>
              )}
            </div>
          </section>

          <div style={{ height: 1, background: "var(--line)", margin: "22px 0" }} />

          <HooksSection onSaved={onHooksSaved} />

          <div style={{ height: 1, background: "var(--line)", margin: "22px 0" }} />

          <ResetSection />
        </div>
      </div>
    </div>
  );
}

function ResetSection() {
  const [confirming, setConfirming] = useState<null | "typed" | "final">(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    setConfirming(null);
    setResetting(true);
    setError(null);
    const res = await resetEnvironment();
    if (res.ok) {
      window.location.reload();
      return;
    }
    setError(res.error ?? "Could not reset the environment.");
    setResetting(false);
  };

  return (
    <section style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <Trash2 size={14} style={{ color: ROSE }} />
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
          Reset environment
        </h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-4)" }}>
        Permanently deletes everything stored on this computer and starts over from setup. This
        cannot be undone.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => setConfirming("typed")}
          disabled={resetting}
          style={{
            ...dangerGhostBtn,
            ...(resetting ? { opacity: 0.6, cursor: "default" } : {}),
          }}
        >
          {resetting ? <Loader2 size={13} style={spin} /> : <Trash2 size={13} />}
          {resetting ? "Resetting" : "Reset environment"}
        </button>

        {error && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12.5,
              color: ROSE,
              fontWeight: 500,
            }}
          >
            <AlertTriangle size={14} /> {error}
          </span>
        )}
      </div>

      {confirming === "typed" && (
        <ConfirmDialog
          title="Reset your environment?"
          detail="Everything stored on this computer is deleted and Mill returns to setup."
          requireText="reset"
          confirmLabel="Continue"
          onConfirm={() => setConfirming("final")}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === "final" && (
        <ConfirmDialog
          title="Delete this workspace for good?"
          confirmLabel="Yes"
          onConfirm={reset}
          onCancel={() => setConfirming(null)}
        />
      )}
    </section>
  );
}

function Field({
  label, aside, children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={fieldLabel}>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function ConnStatus({ status }: { status: ConnStatus }) {
  if (status === "idle") return null;
  if (status === "checking") {
    return (
      <span style={connWrap}>
        <Loader2 size={11} style={{ ...spin, color: "var(--ink-4)" }} />
        <span style={connLabel}>Checking</span>
      </span>
    );
  }
  const online = status === "online";
  const hue = online ? "var(--forest)" : ROSE;
  return (
    <span style={connWrap}>
      <span
        style={{
          ...connDot,
          background: hue,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${hue} 16%, transparent)`,
        }}
      />
      <span style={{ ...connLabel, color: online ? FOREST : ROSE }}>
        {online ? "Connected" : "Can't reach Ollama"}
      </span>
    </span>
  );
}

function PrimaryButton({
  onClick, disabled, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const lifted = hover && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...primaryBtn,
        ...(disabled ? primaryBtnDisabled : null),
        ...(lifted ? primaryBtnHover : null),
      }}
    >
      {children}
    </button>
  );
}

function EndpointToggle({
  mode, onMode,
}: {
  mode: "default" | "custom";
  onMode: (m: "default" | "custom") => void;
}) {
  return (
    <div style={segWrap} role="group" aria-label="Endpoint source">
      {(["default", "custom"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            aria-pressed={active}
            style={{ ...segBtn, ...(active ? segBtnActive : null) }}
          >
            {m === "default" ? "Default" : "Custom"}
          </button>
        );
      })}
    </div>
  );
}

function ProviderToggle({
  value, onChange,
}: {
  value: AiProvider;
  onChange: (v: AiProvider) => void;
}) {
  const options: Array<{ key: AiProvider; label: string }> = [
    { key: "ollama", label: "Ollama" },
    { key: "claude_cli", label: "Claude CLI" },
  ];
  return (
    <div style={segWrap} role="group" aria-label="AI provider">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            style={{ ...segBtn, ...(active ? segBtnActive : null) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ClaudeModelPicker({
  value, onChange, versions, onCheck, checking, check,
}: {
  value: string;
  onChange: (v: string) => void;
  versions: Record<string, string>;
  onCheck: () => void;
  checking: boolean;
  check: ClaudeModelCheck | null;
}) {
  const trimmed = value.trim();
  const isAlias = (CLAUDE_MODEL_ALIASES as readonly string[]).includes(trimmed);
  const cached = isAlias ? versions[trimmed] : undefined;
  const disabled = checking || !trimmed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Claude model shortcuts">
        {CLAUDE_MODEL_ALIASES.map((alias) => {
          const active = alias === trimmed;
          return (
            <button
              key={alias}
              type="button"
              onClick={() => onChange(alias)}
              aria-pressed={active}
              style={{ ...claudePill, ...(active ? claudePillActive : null) }}
            >
              {claudeModelLabel(alias)}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <FocusInput
            value={value}
            onChange={onChange}
            mono
            placeholder="opus, or a full id like claude-opus-5"
            onEnter={onCheck}
          />
        </div>
        <button
          type="button"
          onClick={onCheck}
          disabled={disabled}
          title="Run a quick call to confirm this model works"
          aria-label="Check this model"
          style={{ ...refreshBtn, ...(disabled ? { opacity: 0.55, cursor: "default" } : null) }}
        >
          <RefreshCw size={14} style={checking ? spin : undefined} />
        </button>
      </div>

      {checking ? (
        <p style={{ ...helpText, margin: 0 }}>Checking <code style={inlineCode}>{trimmed}</code>…</p>
      ) : check && !check.ok ? (
        <p style={{ ...helpText, margin: 0, color: ROSE }}>{check.error}</p>
      ) : check && check.ok ? (
        <p style={{ ...helpText, margin: 0, color: FOREST }}>
          Ready. Runs <code style={inlineCode}>{check.resolved}</code>.
        </p>
      ) : cached ? (
        <p style={{ ...helpText, margin: 0 }}>
          <code style={inlineCode}>{trimmed}</code> currently resolves to <code style={inlineCode}>{cached}</code>. Check to re-verify.
        </p>
      ) : (
        <p style={{ ...helpText, margin: 0 }}>
          The options above use the default options for each family of models via the CLI, which are not always the newest releases. For a specific model, type its id (<code style={inlineCode}>claude-opus-5</code>).
        </p>
      )}
    </div>
  );
}

function FocusInput({
  value, onChange, placeholder, mono, autoFocus, onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      value={value}
      autoFocus={autoFocus}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      style={{ ...inputBase, ...(mono ? inputMono : {}), ...(focus ? inputFocus : {}) }}
    />
  );
}

function ModelSelect({
  value, onChange, models, loading, error, conn, onRefresh,
}: {
  value: string;
  onChange: (v: string) => void;
  models: OllamaModel[];
  loading: boolean;
  error: string | null;
  conn: ConnStatus;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const installedNames = useMemo(() => new Set(models.map((m) => m.name)), [models]);
  const valueInstalled = !value || installedNames.has(value);
  const options: OllamaModel[] = valueInstalled
    ? models
    : [{ name: value, size: 0, paramSize: "", quant: "", family: "" }, ...models];
  const selected = options.find((m) => m.name === value) ?? null;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const below = window.innerHeight - r.bottom - gap;
    const above = r.top - gap;
    const openUp = below < 160 && above > below;
    setPos({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + gap,
      bottom: openUp ? window.innerHeight - r.top + gap : undefined,
      maxHeight: Math.max(120, Math.min(264, openUp ? above : below)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault(); e.stopImmediatePropagation();
          setOpen(false); triggerRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault(); e.stopImmediatePropagation();
          setActive((i) => Math.min(options.length - 1, i + 1));
          break;
        case "ArrowUp":
          e.preventDefault(); e.stopImmediatePropagation();
          setActive((i) => Math.max(0, i - 1));
          break;
        case "Home":
          e.preventDefault(); e.stopImmediatePropagation(); setActive(0);
          break;
        case "End":
          e.preventDefault(); e.stopImmediatePropagation();
          setActive(options.length - 1);
          break;
        case "Enter": {
          e.preventDefault(); e.stopImmediatePropagation();
          const m = options[active];
          if (m) { onChange(m.name); setOpen(false); triggerRef.current?.focus(); }
          break;
        }
        case "Tab":
          setOpen(false);
          break;
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, options, active, onChange]);

  const openMenu = () => {
    if (loading && options.length === 0) return;
    setActive(Math.max(0, options.findIndex((m) => m.name === value)));
    setOpen(true);
  };

  const commit = (name: string) => {
    onChange(name);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onTriggerKeyDown}
          disabled={loading && options.length === 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{ ...triggerStyle, ...(open ? inputFocus : {}) }}
        >
          <span style={triggerLabel}>
            {selected ? selected.name : loading ? "Looking for installed models…" : "No model selected"}
          </span>
          <ChevronDown
            size={14}
            style={{
              flexShrink: 0,
              color: "var(--ink-4)",
              transition: "transform 0.16s ease",
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        </button>
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh model list"
          aria-label="Refresh model list"
          style={refreshBtn}
        >
          <RefreshCw size={14} style={loading ? spin : undefined} />
        </button>
      </div>

      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
              ...menuStyle,
            }}
          >
            {options.length === 0 ? (
              <div style={menuEmpty}>No models found.</div>
            ) : (
              options.map((m, i) => {
                const isSel = m.name === value;
                const missing = !installedNames.has(m.name);
                return (
                  <button
                    key={m.name}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(m.name)}
                    style={{ ...rowStyle, background: i === active ? "var(--paper-3)" : "transparent" }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={rowName}>{m.name}</span>
                      <span style={{ ...rowMeta, color: missing ? ROSE : "var(--ink-4)" }}>
                        {missing ? "not installed" : modelMeta(m)}
                      </span>
                    </span>
                    {isSel && <Check size={14} style={{ flexShrink: 0, color: FOREST }} />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}

      {error ? (
        <span style={{ fontSize: 11.5, color: ROSE, lineHeight: 1.5 }}>{error}</span>
      ) : (
        <span style={{ ...helpText, margin: 0 }}>
          {loading
            ? "Looking for installed models…"
            : conn === "offline"
            ? "Connect to Ollama to load models."
            : `${models.length} model${models.length === 1 ? "" : "s"} installed.`}
        </span>
      )}
    </div>
  );
}

interface MenuPos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 400,
  background: "oklch(14% 0.008 85 / 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  animation: "composerFadeIn 0.18s ease",
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 540,
  maxHeight: "88vh",
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  boxShadow: "0 24px 60px oklch(14% 0.008 85 / 0.18), 0 4px 16px oklch(14% 0.008 85 / 0.06)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "composerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid var(--line)",
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, display: "inline-flex",
  alignItems: "center", justifyContent: "center", color: "var(--ink-4)",
  background: "transparent", border: "1px solid transparent", cursor: "pointer",
};

const bodyStyle: React.CSSProperties = {
  padding: "22px 20px 24px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};

const sectionStyle: React.CSSProperties = { display: "flex", flexDirection: "column" };

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-3)",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 13,
  color: "var(--ink)",
  background: "var(--paper)",
  outline: "none",
  fontFamily: "var(--sans)",
  transition: "border-color 0.14s",
};

const inputMono: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 12.5 };

const inputFocus: React.CSSProperties = {
  border: `1px solid ${FOREST}`,
};

const helpText: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--ink-4)",
  lineHeight: 1.5,
  margin: "8px 0 0",
};

const segWrap: React.CSSProperties = {
  display: "inline-flex",
  alignSelf: "flex-start",
  gap: 3,
  padding: 3,
  background: "var(--paper-2)",
  border: "1px solid var(--line)",
  borderRadius: 9,
};

const segBtn: React.CSSProperties = {
  appearance: "none",
  border: "none",
  background: "transparent",
  color: "var(--ink-4)",
  borderRadius: 6,
  padding: "5px 15px",
  fontSize: 12.5,
  fontFamily: "var(--sans)",
  cursor: "pointer",
  transition: "background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease",
};

const segBtnActive: React.CSSProperties = {
  background: "var(--paper)",
  color: "var(--ink)",
  fontWeight: 500,
  boxShadow: "0 1px 2px oklch(20% 0.01 85 / 0.12)",
};

const claudePill: React.CSSProperties = {
  appearance: "none",
  border: "1px solid var(--line)",
  background: "var(--paper)",
  color: "var(--ink-2)",
  borderRadius: 8,
  padding: "6px 13px",
  fontSize: 12.5,
  fontFamily: "var(--sans)",
  cursor: "pointer",
  transition: "background 0.16s ease, color 0.16s ease, border-color 0.16s ease",
};

const claudePillActive: React.CSSProperties = {
  background: FOREST,
  color: "oklch(97% 0.02 140)",
  border: `1px solid ${FOREST}`,
  fontWeight: 600,
};

const endpointNote: React.CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  color: "var(--ink-4)",
  fontFamily: "var(--sans)",
};

const endpointNoteUrl: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--ink-2)",
};

const inlineCode: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11.5,
  padding: "1px 5px",
  borderRadius: 4,
  background: "var(--paper-3)",
  color: "var(--ink-2)",
};

const triggerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 13,
  color: "var(--ink)",
  background: "var(--paper)",
  outline: "none",
  fontFamily: "var(--sans)",
  cursor: "pointer",
  textAlign: "left",
  transition: "border-color 0.14s",
};

const triggerLabel: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "var(--mono)",
  fontSize: 12.5,
};

const menuStyle: React.CSSProperties = {
  zIndex: 500,
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  boxShadow:
    "0 12px 30px oklch(14% 0.008 85 / 0.16), 0 2px 8px oklch(14% 0.008 85 / 0.07)",
  padding: 5,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 1,
  animation: "millMenuIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
};

const menuEmpty: React.CSSProperties = {
  padding: "10px 11px",
  fontSize: 12,
  color: "var(--ink-4)",
  fontFamily: "var(--sans)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 7,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "var(--sans)",
  transition: "background 0.12s",
};

const rowName: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12.5,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowMeta: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10.5,
  letterSpacing: "0.01em",
};

const refreshBtn: React.CSSProperties = {
  flexShrink: 0,
  width: 34,
  height: 34,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ink-3)",
  background: "transparent",
  border: "1px solid var(--line)",
  cursor: "pointer",
};

const baseBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "var(--sans)",
  border: "1px solid transparent",
  transition: "background 0.16s, color 0.16s, border-color 0.16s, opacity 0.16s",
};

const dangerGhostBtn: React.CSSProperties = {
  ...baseBtn,
  border: "1px solid var(--line)",
  background: "transparent",
  color: ROSE,
};

const primaryBtn: React.CSSProperties = {
  ...baseBtn,
  background: FOREST,
  color: "oklch(97% 0.02 140)",
  fontWeight: 600,
  letterSpacing: "0.01em",
  transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease",
};

const primaryBtnHover: React.CSSProperties = {
  transform: "scale(1.05)",
};

const primaryBtnDisabled: React.CSSProperties = {
  background: "var(--paper-3)",
  color: "var(--ink-4)",
  cursor: "not-allowed",
};

const connWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11.5,
  fontFamily: "var(--sans)",
};
const connLabel: React.CSSProperties = {
  color: "var(--ink-4)",
  fontWeight: 500,
  letterSpacing: "0.01em",
};
const connDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  flexShrink: 0,
};

const spin: React.CSSProperties = { animation: "millSpin 0.7s linear infinite" };
