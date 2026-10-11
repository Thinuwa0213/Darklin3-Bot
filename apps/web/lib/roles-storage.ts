import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_ROLE_PANELS_CONFIG,
  type RolePanelsConfig,
  type RolePanel,
  type RoleAssignmentLog,
} from "./roles-types";

export {
  DEFAULT_ROLE_PANELS_CONFIG,
  type RolePanelsConfig,
  type RolePanel,
  type RoleAssignmentLog,
};

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredRolePanels(
  tenantId: string,
  guildId: string,
): Promise<RolePanelsConfig> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "roles-panels.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<RolePanelsConfig>;

    return {
      panels: Array.isArray(parsed.panels) ? parsed.panels : [],
      loggingEnabled: parsed.loggingEnabled ?? true,
      logChannelId: parsed.logChannelId ?? undefined,
    };
  } catch {
    return { ...DEFAULT_ROLE_PANELS_CONFIG };
  }
}

export async function writeStoredRolePanels(
  tenantId: string,
  guildId: string,
  data: RolePanelsConfig,
): Promise<RolePanelsConfig> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "roles-panels.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return data;
}

export async function readStoredRoleLogs(
  tenantId: string,
  guildId: string,
): Promise<RoleAssignmentLog[]> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "roles-logs.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as RoleAssignmentLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendStoredRoleLog(
  tenantId: string,
  guildId: string,
  log: RoleAssignmentLog,
): Promise<void> {
  try {
    const existing = await readStoredRoleLogs(tenantId, guildId);
    // Keep the most recent 100 logs
    const updated = [log, ...existing].slice(0, 100);

    const storageDir = resolveStorageDir();
    const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
    const filePath = path.join(dirPath, "roles-logs.json");

    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
  } catch {
    // Non-fatal logging failure
  }
}
