import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_ACTION_LOGS_CONFIG, type ActionLogsConfig } from "./action-logs-types";

export { DEFAULT_ACTION_LOGS_CONFIG, type ActionLogsConfig };

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredActionLogsConfig(
  tenantId: string,
  guildId: string,
): Promise<ActionLogsConfig> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "action-logs.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<ActionLogsConfig>;

    return {
      enabled: parsed.enabled ?? DEFAULT_ACTION_LOGS_CONFIG.enabled,
      defaultChannelId: parsed.defaultChannelId ?? DEFAULT_ACTION_LOGS_CONFIG.defaultChannelId,
      specifyPerCategory: parsed.specifyPerCategory ?? DEFAULT_ACTION_LOGS_CONFIG.specifyPerCategory,
      individualChannels: parsed.individualChannels ?? DEFAULT_ACTION_LOGS_CONFIG.individualChannels ?? false,
      showMemberAvatars: parsed.showMemberAvatars ?? DEFAULT_ACTION_LOGS_CONFIG.showMemberAvatars ?? true,
      newAccountAgeDays: parsed.newAccountAgeDays ?? DEFAULT_ACTION_LOGS_CONFIG.newAccountAgeDays ?? 7,
      eventChannels: parsed.eventChannels ?? {},
      categories: {
        messages: {
          ...DEFAULT_ACTION_LOGS_CONFIG.categories.messages,
          ...(parsed.categories?.messages || {}),
        },
        members: {
          ...DEFAULT_ACTION_LOGS_CONFIG.categories.members,
          ...(parsed.categories?.members || {}),
        },
        moderation: {
          ...DEFAULT_ACTION_LOGS_CONFIG.categories.moderation,
          ...(parsed.categories?.moderation || {}),
        },
        channelsAndRoles: {
          ...DEFAULT_ACTION_LOGS_CONFIG.categories.channelsAndRoles,
          ...(parsed.categories?.channelsAndRoles || {}),
        },
        voice: {
          ...DEFAULT_ACTION_LOGS_CONFIG.categories.voice,
          ...(parsed.categories?.voice || {}),
        },
      },
      ignoredChannels: Array.isArray(parsed.ignoredChannels) ? parsed.ignoredChannels : [],
      ignoredRoles: Array.isArray(parsed.ignoredRoles) ? parsed.ignoredRoles : [],
    };
  } catch {
    return { ...DEFAULT_ACTION_LOGS_CONFIG };
  }
}

export async function writeStoredActionLogsConfig(
  tenantId: string,
  guildId: string,
  data: ActionLogsConfig,
): Promise<ActionLogsConfig> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "action-logs.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return data;
}
