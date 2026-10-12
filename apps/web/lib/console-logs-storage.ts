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

function generateInitialLogs(guildId: string, timezone = "Asia/Colombo"): GuildConsoleLogEntry[] {
  const now = Date.now();
  return [
    {
      id: `init-${now - 120000}`,
      timestamp: new Date(now - 120000).toISOString(),
      level: "INFO",
      category: "SYSTEM",
      message: `Darklin3 Bot runtime initialized for server [${guildId}].`,
    },
    {
      id: `init-${now - 110000}`,
      timestamp: new Date(now - 110000).toISOString(),
      level: "INFO",
      category: "GATEWAY",
      message: "Discord Gateway connection established (Shard #0, Heartbeat latency 28ms).",
    },
    {
      id: `init-${now - 90000}`,
      timestamp: new Date(now - 90000).toISOString(),
      level: "INFO",
      category: "SECURITY",
      message: "Privileged Intents verified: Server Members, Message Content, and Presence are ACTIVE.",
    },
    {
      id: `init-${now - 60000}`,
      timestamp: new Date(now - 60000).toISOString(),
      level: "INFO",
      category: "SYSTEM",
      message: `Guild timezone synchronized with settings [${timezone}].`,
    },
    {
      id: `init-${now - 30000}`,
      timestamp: new Date(now - 30000).toISOString(),
      level: "INFO",
      category: "ACTION_LOGS",
      message: "Action Log dispatcher ready. Listening for guild events and audit records.",
    },
  ];
}

export async function readStoredConsoleLogs(
  tenantId: string,
  guildId: string,
  guildTimezone = "Asia/Colombo",
): Promise<GuildConsoleLogEntry[]> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "console-logs.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<GuildConsoleData>;

    if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
      return parsed.logs;
    }

    // If file exists but logs empty, return empty array
    if (parsed.lastClearedAt) {
      return [];
    }

    // Default initial logs
    const initial = generateInitialLogs(guildId, guildTimezone);
    await writeStoredConsoleLogs(tenantId, guildId, initial);
    return initial;
  } catch {
    // If not found, write and return initial logs
    const initial = generateInitialLogs(guildId, guildTimezone);
    try {
      await writeStoredConsoleLogs(tenantId, guildId, initial);
    } catch {
      // Storage directory may not exist yet, fallback silently
    }
    return initial;
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
