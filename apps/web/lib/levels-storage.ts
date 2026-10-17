import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_LEVEL_SETTINGS,
  DEFAULT_RANK_CARD_CONFIG,
  type LevelRoleReward,
  type LevelSettings,
  type RankCardConfig,
  type UserXpRecord,
} from "./levels-types";

export {
  DEFAULT_LEVEL_SETTINGS,
  DEFAULT_RANK_CARD_CONFIG,
  type LevelRoleReward,
  type LevelSettings,
  type RankCardConfig,
  type UserXpRecord,
};

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredLevelSettings(
  tenantId: string,
  guildId: string,
): Promise<LevelSettings> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "levels.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    // Sanitize any legacy fallback dummy roles (r-regular, r-veteran, etc.)
    const cleanRoleRewards = Array.isArray(parsed.roleRewards)
      ? parsed.roleRewards.filter((r: LevelRoleReward) => r && !r.roleId.startsWith("r-"))
      : [];

    return {
      ...DEFAULT_LEVEL_SETTINGS,
      ...parsed,
      roleRewards: cleanRoleRewards,
    };
  } catch {
    return DEFAULT_LEVEL_SETTINGS;
  }
}

export async function writeStoredLevelSettings(
  tenantId: string,
  guildId: string,
  data: LevelSettings,
): Promise<LevelSettings> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "levels.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

  return data;
}

export async function readStoredGuildUsers(
  tenantId: string,
  guildId: string,
): Promise<UserXpRecord[]> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "levels-users.json");
    const content = await fs.readFile(filePath, "utf-8");
    const users = JSON.parse(content);
    if (Array.isArray(users)) return users;
    if (typeof users === "object" && users !== null) return Object.values(users);
    return [];
  } catch {
    return [];
  }
}

export async function writeStoredGuildUsers(
  tenantId: string,
  guildId: string,
  users: UserXpRecord[],
): Promise<void> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "levels-users.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(users, null, 2), "utf-8");
}
