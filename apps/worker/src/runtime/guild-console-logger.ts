import fs from "node:fs/promises";
import path from "node:path";

export type ConsoleLogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "DEBUG";

export type ConsoleLogCategory =
  | "SYSTEM"
  | "GATEWAY"
  | "ACTION_LOGS"
  | "AUTO_MOD"
  | "WELCOME"
  | "ROLES"
  | "STREAMS"
  | "BOOSTER"
  | "SECURITY";

export interface GuildConsoleLogEntry {
  id: string;
  timestamp: string;
  level: ConsoleLogLevel;
  category: ConsoleLogCategory;
  message: string;
  details?: string | undefined;
}

const MAX_CONSOLE_LOGS = 500;

function resolveStorageTenantsDir(): string {
  const candidates: string[] = [
    path.resolve(process.cwd(), "storage", "tenants"),
    path.resolve(process.cwd(), "..", "..", "storage", "tenants"),
  ];

  for (const dir of candidates) {
    try {
      return dir;
    } catch {
      // next
    }
  }
  return candidates[1] ?? candidates[0] ?? path.resolve(process.cwd(), "storage", "tenants");
}

/**
 * Appends an operational or diagnostic log for a specific Discord guild.
 * Scoped strictly to that guild's multi-tenant isolation.
 */
export async function logToGuildConsole(
  guildId: string,
  entry: {
    level: ConsoleLogLevel;
    category: ConsoleLogCategory;
    message: string;
    details?: string;
  },
): Promise<void> {
  try {
    const tenantsDir = resolveStorageTenantsDir();
    let tenants: any[] = [];
    try {
      tenants = await fs.readdir(tenantsDir, { withFileTypes: true });
    } catch {
      return;
    }

    const newLog: GuildConsoleLogEntry = {
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      level: entry.level,
      category: entry.category,
      message: entry.message,
      ...(entry.details !== undefined ? { details: entry.details } : {}),
    };

    // Locate the tenant owning this guild
    for (const tenant of tenants) {
      if (!tenant.isDirectory()) continue;
      const guildDir = path.join(tenantsDir, tenant.name, "guilds", guildId);
      const consoleLogPath = path.join(guildDir, "console-logs.json");

      try {
        let existingLogs: GuildConsoleLogEntry[] = [];
        try {
          const raw = await fs.readFile(consoleLogPath, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.logs)) {
            existingLogs = parsed.logs;
          }
        } catch {
          // New file will be created
        }

        const updated = [...existingLogs, newLog].slice(-MAX_CONSOLE_LOGS);
        await fs.mkdir(guildDir, { recursive: true });
        await fs.writeFile(consoleLogPath, JSON.stringify({ logs: updated }, null, 2), "utf-8");
        break;
      } catch {
        // Continue search
      }
    }
  } catch {
    // Non-fatal, never crash the bot worker
  }
}
