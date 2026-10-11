import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_MODERATION_CONFIG, type ModerationConfig } from "./moderation-types";

export { DEFAULT_MODERATION_CONFIG, type ModerationConfig };

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredModerationConfig(
  tenantId: string,
  guildId: string,
): Promise<ModerationConfig> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "moderation.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<ModerationConfig>;

    return {
      enabled: parsed.enabled ?? DEFAULT_MODERATION_CONFIG.enabled,
      logChannelId: parsed.logChannelId ?? DEFAULT_MODERATION_CONFIG.logChannelId,
      antiSpam: {
        ...DEFAULT_MODERATION_CONFIG.antiSpam,
        ...(parsed.antiSpam || {}),
      },
      imageSpam: {
        ...(DEFAULT_MODERATION_CONFIG.imageSpam || {
          enabled: true,
          maxImages: 3,
          timeSpan: 5,
          action: "DELETE",
          timeoutSeconds: 300,
          sendAlert: true,
          sendDm: true,
        }),
        ...(parsed.imageSpam || {}),
      },
      antiInvites: {
        ...DEFAULT_MODERATION_CONFIG.antiInvites,
        ...(parsed.antiInvites || {}),
        allowedInvites: Array.isArray(parsed.antiInvites?.allowedInvites)
          ? parsed.antiInvites.allowedInvites
          : DEFAULT_MODERATION_CONFIG.antiInvites.allowedInvites,
      },
      badWords: {
        ...DEFAULT_MODERATION_CONFIG.badWords,
        ...(parsed.badWords || {}),
        words: Array.isArray(parsed.badWords?.words)
          ? parsed.badWords.words
          : DEFAULT_MODERATION_CONFIG.badWords.words,
      },
      massMentions: {
        ...DEFAULT_MODERATION_CONFIG.massMentions,
        ...(parsed.massMentions || {}),
      },
      capsLimit: {
        ...DEFAULT_MODERATION_CONFIG.capsLimit,
        ...(parsed.capsLimit || {}),
      },
      customRules: Array.isArray(parsed.customRules) ? parsed.customRules : [],
      ignoredChannels: Array.isArray(parsed.ignoredChannels) ? parsed.ignoredChannels : [],
      ignoredRoles: Array.isArray(parsed.ignoredRoles) ? parsed.ignoredRoles : [],
    };
  } catch {
    return { ...DEFAULT_MODERATION_CONFIG };
  }
}

export async function writeStoredModerationConfig(
  tenantId: string,
  guildId: string,
  data: ModerationConfig,
): Promise<ModerationConfig> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "moderation.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return data;
}
