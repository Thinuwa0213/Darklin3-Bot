import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_BOOSTER_CONFIG, type BoosterConfig } from "./booster-types";

export { DEFAULT_BOOSTER_CONFIG, type BoosterConfig };

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredBoosterConfig(
  tenantId: string,
  guildId: string,
): Promise<BoosterConfig> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "booster.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<BoosterConfig>;

    return {
      enabled: parsed.enabled ?? DEFAULT_BOOSTER_CONFIG.enabled,
      channelId: parsed.channelId ?? DEFAULT_BOOSTER_CONFIG.channelId,
      useEmbed: parsed.useEmbed ?? DEFAULT_BOOSTER_CONFIG.useEmbed,
      pingUser: parsed.pingUser ?? DEFAULT_BOOSTER_CONFIG.pingUser,
      title: parsed.title ?? DEFAULT_BOOSTER_CONFIG.title,
      message: parsed.message ?? DEFAULT_BOOSTER_CONFIG.message,
      accentColor: parsed.accentColor ?? DEFAULT_BOOSTER_CONFIG.accentColor,
      bannerUrl: parsed.bannerUrl ?? DEFAULT_BOOSTER_CONFIG.bannerUrl,
      thankYouDm: parsed.thankYouDm ?? DEFAULT_BOOSTER_CONFIG.thankYouDm,
      thankYouDmMessage: parsed.thankYouDmMessage ?? DEFAULT_BOOSTER_CONFIG.thankYouDmMessage,
      customBranding: parsed.customBranding ?? DEFAULT_BOOSTER_CONFIG.customBranding,
      customFooterText: parsed.customFooterText ?? DEFAULT_BOOSTER_CONFIG.customFooterText,
      customFooterIconUrl: parsed.customFooterIconUrl ?? DEFAULT_BOOSTER_CONFIG.customFooterIconUrl,
    };
  } catch {
    return { ...DEFAULT_BOOSTER_CONFIG };
  }
}

export async function writeStoredBoosterConfig(
  tenantId: string,
  guildId: string,
  data: BoosterConfig,
): Promise<BoosterConfig> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "booster.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return data;
}
