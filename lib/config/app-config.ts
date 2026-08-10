import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import type { StorageInfo } from "@/lib/types";

export interface AppConfig {
  databaseUrl: string;
}

const MILL_DIR = join(homedir(), ".mill");
const CONFIG_PATH = join(MILL_DIR, "config.json");
const DEFAULT_DB_PATH = join(MILL_DIR, "mill.db");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function defaultLocalDbUrl(): string {
  return `file:${DEFAULT_DB_PATH}`;
}

function isLibsqlUrl(url: string): boolean {
  return /^(file:|libsql:\/\/|wss?:\/\/|https?:\/\/)/i.test(url.trim());
}

export function readAppConfig(): AppConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<AppConfig>;
    const url = typeof parsed.databaseUrl === "string" ? parsed.databaseUrl.trim() : "";
    if (url && isLibsqlUrl(url)) {
      return { databaseUrl: url };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeAppConfig(databaseUrl: string): void {
  if (!existsSync(MILL_DIR)) mkdirSync(MILL_DIR, { recursive: true });
  const next: AppConfig = { databaseUrl: databaseUrl.trim() };
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function clearAppConfig(): void {
  if (existsSync(CONFIG_PATH)) rmSync(CONFIG_PATH);
}

export function resolveDatabaseUrl(): string | null {
  const fromFile = readAppConfig();
  if (fromFile) return fromFile.databaseUrl;
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv && isLibsqlUrl(fromEnv)) return fromEnv;
  return null;
}

export function databaseUrlSource(): "file" | "env" | "none" {
  if (readAppConfig()) return "file";
  const env = process.env.DATABASE_URL?.trim();
  if (env && isLibsqlUrl(env)) return "env";
  return "none";
}

export function isStorageConfigured(): boolean {
  return resolveDatabaseUrl() !== null;
}

function displayStorage(url: string): string {
  if (url.startsWith("file:")) return prettyPath(url.slice("file:".length));
  return url;
}

function prettyPath(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(home + "/")
    ? "~" + path.slice(home.length)
    : path;
}

export function getStorageInfo(): StorageInfo {
  const url = resolveDatabaseUrl();
  return {
    configured: url !== null,
    source: databaseUrlSource(),
    display: url ? displayStorage(url) : null,
  };
}
