import fs from "node:fs/promises";
import path from "node:path";
import {
  type GuildConsoleLogEntry,
  type GuildConsoleData,
  type ConsoleLogLevel,
  type ConsoleLogCategory,
} from "./console-logs-types";

export * from "./console-logs-types";

const MAX_CONSOLE_LOGS = 100;

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredConsoleLogs(
  tenantId: string,
  guildId: string,
  _guildTimezone = "Asia/Colombo",
): Promise<GuildConsoleLogEntry[]> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "console-logs.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<GuildConsoleData>;

    if (Array.isArray(parsed.logs)) {
      // Return genuine logs only, filtering out any legacy mock dummy data
      return parsed.logs.filter((l) => !l.id.startsWith("init-"));
    }

    return [];
  } catch {
    return [];
  }
}

export async function writeStoredConsoleLogs(
  tenantId: string,
  guildId: string,
  logs: GuildConsoleLogEntry[],
): Promise<void> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "console-logs.json");

  await fs.mkdir(dirPath, { recursive: true });
  const data: GuildConsoleData = {
    logs: logs.slice(-MAX_CONSOLE_LOGS),
  };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function appendStoredConsoleLog(
  tenantId: string,
  guildId: string,
  entry: {
    level: ConsoleLogLevel;
    category?: ConsoleLogCategory;
    message: string;
    details?: string;
  },
): Promise<GuildConsoleLogEntry> {
  const currentLogs = await readStoredConsoleLogs(tenantId, guildId);
  const newEntry: GuildConsoleLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level: entry.level,
    category: entry.category ?? "SYSTEM",
    message: entry.message,
    ...(entry.details !== undefined ? { details: entry.details } : {}),
  };

  const updated = [...currentLogs, newEntry].slice(-MAX_CONSOLE_LOGS);
  await writeStoredConsoleLogs(tenantId, guildId, updated);
  return newEntry;
}

export async function clearStoredConsoleLogs(
  tenantId: string,
  guildId: string,
): Promise<void> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "console-logs.json");

  await fs.mkdir(dirPath, { recursive: true });
  const data: GuildConsoleData = {
    logs: [],
    lastClearedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
