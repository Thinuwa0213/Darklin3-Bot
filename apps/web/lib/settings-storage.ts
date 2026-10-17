import fs from "node:fs/promises";
import path from "node:path";

export interface GuildBrandingSettings {
  customBrandingEnabled: boolean;
  defaultFooterText: string;
  defaultFooterIconUrl: string;
  defaultEmbedColor: string;
  showTimestampDefault: boolean;
}

export interface GuildSettings {
  timezone: string;
  locale: string;
  systemAlertChannelId: string;
  notificationChannelId: string;
  branding: GuildBrandingSettings;
}

export const DEFAULT_GUILD_SETTINGS: GuildSettings = {
  timezone: "Asia/Colombo",
  locale: "en",
  systemAlertChannelId: "",
  notificationChannelId: "",
  branding: {
    customBrandingEnabled: false,
    defaultFooterText: "⚡ Alert powered by Darklin3 Bot",
    defaultFooterIconUrl: "",
    defaultEmbedColor: "#5865F2",
    showTimestampDefault: true,
  },
};

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredSettings(
  tenantId: string,
  guildId: string,
): Promise<GuildSettings> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "settings.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<GuildSettings>;

    return {
      ...DEFAULT_GUILD_SETTINGS,
      ...parsed,
      branding: {
        ...DEFAULT_GUILD_SETTINGS.branding,
        ...(parsed.branding || {}),
      },
    };
  } catch {
    return DEFAULT_GUILD_SETTINGS;
  }
}

export async function writeStoredSettings(
  tenantId: string,
  guildId: string,
  settings: GuildSettings,
): Promise<void> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "settings.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");
}
