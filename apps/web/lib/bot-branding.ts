import { callApiServer } from "@/lib/api";

export interface BotBrandingInfo {
  botName: string;
  botAvatarUrl: string | null;
}

/**
 * Authoritatively fetch the server/guild's bot branding (real Discord bot name & avatar)
 * for live mockups and Discord previews across all modules.
 */
export async function getGuildBotBranding(
  tenantId: string,
  guildId: string,
  fallbackName = "Darklin3 Bot",
): Promise<BotBrandingInfo> {
  try {
    const brandingRes = await callApiServer<{
      botName: string;
      discordAvatarUrl: string | null;
      customAvatarUrl: string | null;
    }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding`,
    );

    if (brandingRes.ok && brandingRes.data) {
      return {
        botName: brandingRes.data.botName || fallbackName,
        botAvatarUrl:
          brandingRes.data.customAvatarUrl ?? brandingRes.data.discordAvatarUrl ?? null,
      };
    }
  } catch {
    // Return graceful fallback
  }

  return {
    botName: fallbackName,
    botAvatarUrl: null,
  };
}
