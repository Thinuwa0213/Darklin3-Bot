import fs from "node:fs/promises";
import path from "node:path";

export interface StoredStreamerAlert {
  id: string;
  platform: "twitch" | "youtube" | "kick" | "tiktok";
  channelName: string;
  channelUrl: string;
  discordChannelId: string;
  discordChannelName?: string | undefined;
  pingRoleId?: string | undefined;
  pingRoleName?: string | undefined;
  discordUserId?: string | undefined;
  discordUsername?: string | undefined;
  notifyLive?: boolean | undefined;
  notifyUploads?: boolean | undefined;
  lastStatus?: "offline" | "live" | undefined;
  lastStreamId?: string | null | undefined;
  lastVideoId?: string | null | undefined;
  lastMessageId?: string | null | undefined;
  lastCheckedAt?: string | null | undefined;
}

export interface CommunityRadarConfig {
  enabled: boolean;
  keywords: string[];
  gameFilter?: string | undefined;
  requiredRoleId?: string | undefined;
  requiredRoleName?: string | undefined;
  liveRoleId?: string | undefined;
  liveRoleName?: string | undefined;
  discordChannelId?: string | undefined;
  discordChannelName?: string | undefined;
  pingRoleId?: string | undefined;
  pingRoleName?: string | undefined;
  customMessage?: string | undefined;
  cooldownMinutes?: number | undefined;
  customBranding?: boolean | undefined;
  customFooterText?: string | undefined;
}

export interface StoredStreamsConfig {
  enabled: boolean;
  autoCleanup: boolean;
  customLiveMessage: string;
  customUploadMessage: string;
  liveRoleEnabled?: boolean | undefined;
  liveRoleId?: string | undefined;
  liveRoleName?: string | undefined;
  autoPresenceRole?: boolean | undefined;
  customBranding?: boolean | undefined;
  customFooterText?: string | undefined;
  streamers: StoredStreamerAlert[];
  communityRadar?: CommunityRadarConfig | undefined;
  updatedAt?: string | undefined;
}

export const DEFAULT_COMMUNITY_RADAR_CONFIG: CommunityRadarConfig = {
  enabled: false,
  keywords: [],
  gameFilter: "",
  requiredRoleId: undefined,
  requiredRoleName: undefined,
  liveRoleId: undefined,
  liveRoleName: undefined,
  discordChannelId: undefined,
  discordChannelName: undefined,
  pingRoleId: "none",
  pingRoleName: "No Ping (Silent)",
  customMessage: "🎮 **{member}** is streaming **{game}** with **{keyword}**!\nCome hang out: {url}",
  cooldownMinutes: 360,
  customBranding: false,
  customFooterText: undefined,
};

export const DEFAULT_STREAMS_CONFIG: StoredStreamsConfig = {
  enabled: true,
  autoCleanup: false,
  customLiveMessage: "Hey {role}, **{streamer}** is now LIVE!\n{url}",
  customUploadMessage: "🎬 New video uploaded by **{streamer}**!\n**{title}**\nWatch here: {url}",
  liveRoleEnabled: false,
  autoPresenceRole: false,
  customBranding: false,
  customFooterText: undefined,
  streamers: [],
  communityRadar: DEFAULT_COMMUNITY_RADAR_CONFIG,
};

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredStreams(
  tenantId: string,
  guildId: string,
): Promise<StoredStreamsConfig> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "streams.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<StoredStreamsConfig>;

    return {
      enabled: parsed.enabled ?? true,
      autoCleanup: parsed.autoCleanup ?? false,
      customLiveMessage: parsed.customLiveMessage ?? DEFAULT_STREAMS_CONFIG.customLiveMessage,
      customUploadMessage: parsed.customUploadMessage ?? DEFAULT_STREAMS_CONFIG.customUploadMessage,
      liveRoleEnabled: parsed.liveRoleEnabled ?? false,
      liveRoleId: parsed.liveRoleId,
      liveRoleName: parsed.liveRoleName,
      autoPresenceRole: parsed.autoPresenceRole ?? false,
      customBranding: parsed.customBranding ?? false,
      customFooterText: parsed.customFooterText,
      streamers: Array.isArray(parsed.streamers) ? parsed.streamers : [],
      communityRadar: parsed.communityRadar
        ? {
            enabled: parsed.communityRadar.enabled ?? false,
            keywords: Array.isArray(parsed.communityRadar.keywords) ? parsed.communityRadar.keywords : ["[SLRP]"],
            gameFilter: parsed.communityRadar.gameFilter,
            requiredRoleId: parsed.communityRadar.requiredRoleId,
            requiredRoleName: parsed.communityRadar.requiredRoleName,
            liveRoleId: parsed.communityRadar.liveRoleId,
            liveRoleName: parsed.communityRadar.liveRoleName,
            discordChannelId: parsed.communityRadar.discordChannelId,
            discordChannelName: parsed.communityRadar.discordChannelName,
            pingRoleId: parsed.communityRadar.pingRoleId,
            pingRoleName: parsed.communityRadar.pingRoleName,
            customMessage: parsed.communityRadar.customMessage ?? DEFAULT_COMMUNITY_RADAR_CONFIG.customMessage,
            cooldownMinutes: parsed.communityRadar.cooldownMinutes ?? 360,
            customBranding: parsed.communityRadar.customBranding ?? false,
            customFooterText: parsed.communityRadar.customFooterText,
          }
        : DEFAULT_COMMUNITY_RADAR_CONFIG,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return DEFAULT_STREAMS_CONFIG;
  }
}

export async function writeStoredStreams(
  tenantId: string,
  guildId: string,
  data: Partial<StoredStreamsConfig>,
): Promise<StoredStreamsConfig> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "streams.json");

  // Read existing so we preserve historical states
  const existing = await readStoredStreams(tenantId, guildId);
  const existingMap = new Map(existing.streamers.map((s) => [s.id, s]));

  const sanitizedStreamers: StoredStreamerAlert[] = (data.streamers ?? []).map((st, index) => {
    const prev = existingMap.get(st.id);
    const validPlatform = (["twitch", "youtube", "kick", "tiktok"].includes(st.platform)
      ? st.platform
      : "twitch") as "twitch" | "youtube" | "kick" | "tiktok";

    return {
      id: st.id || `st-${Date.now()}-${index}`,
      platform: validPlatform,
      channelName: typeof st.channelName === "string" ? st.channelName.trim().slice(0, 100) : "",
      channelUrl: typeof st.channelUrl === "string" ? st.channelUrl.trim().slice(0, 255) : "",
      discordChannelId: typeof st.discordChannelId === "string" ? st.discordChannelId.trim() : "",
      discordChannelName: typeof st.discordChannelName === "string" ? st.discordChannelName.trim() : undefined,
      pingRoleId: typeof st.pingRoleId === "string" ? st.pingRoleId.trim() : undefined,
      pingRoleName: typeof st.pingRoleName === "string" ? st.pingRoleName.trim() : undefined,
      discordUserId: typeof st.discordUserId === "string" ? st.discordUserId.trim() : undefined,
      discordUsername: typeof st.discordUsername === "string" ? st.discordUsername.trim() : undefined,
      notifyLive: typeof st.notifyLive === "boolean" ? st.notifyLive : true,
      notifyUploads:
        typeof st.notifyUploads === "boolean"
          ? st.notifyUploads
          : validPlatform === "youtube" || validPlatform === "tiktok",
      lastStatus: prev?.lastStatus ?? st.lastStatus ?? "offline",
      lastStreamId: prev?.lastStreamId ?? st.lastStreamId ?? null,
      lastVideoId: prev?.lastVideoId ?? st.lastVideoId ?? null,
      lastMessageId: prev?.lastMessageId ?? st.lastMessageId ?? null,
      lastCheckedAt: prev?.lastCheckedAt ?? st.lastCheckedAt ?? null,
    };
  });

  const payload: StoredStreamsConfig = {
    enabled: typeof data.enabled === "boolean" ? data.enabled : existing.enabled,
    autoCleanup: typeof data.autoCleanup === "boolean" ? data.autoCleanup : existing.autoCleanup,
    customLiveMessage:
      typeof data.customLiveMessage === "string" && data.customLiveMessage.trim()
        ? data.customLiveMessage.trim().slice(0, 1000)
        : DEFAULT_STREAMS_CONFIG.customLiveMessage,
    customUploadMessage:
      typeof data.customUploadMessage === "string" && data.customUploadMessage.trim()
        ? data.customUploadMessage.trim().slice(0, 1000)
        : DEFAULT_STREAMS_CONFIG.customUploadMessage,
    liveRoleEnabled:
      typeof data.liveRoleEnabled === "boolean" ? data.liveRoleEnabled : existing.liveRoleEnabled,
    liveRoleId: typeof data.liveRoleId === "string" ? data.liveRoleId.trim() : existing.liveRoleId,
    liveRoleName: typeof data.liveRoleName === "string" ? data.liveRoleName.trim() : existing.liveRoleName,
    autoPresenceRole:
      typeof data.autoPresenceRole === "boolean" ? data.autoPresenceRole : existing.autoPresenceRole,
    customBranding:
      typeof data.customBranding === "boolean" ? data.customBranding : (existing.customBranding ?? false),
    customFooterText:
      typeof data.customFooterText === "string" ? data.customFooterText.trim().slice(0, 100) : existing.customFooterText,
    streamers: sanitizedStreamers,
    communityRadar: data.communityRadar
      ? {
          enabled: typeof data.communityRadar.enabled === "boolean" ? data.communityRadar.enabled : (existing.communityRadar?.enabled ?? false),
          keywords: Array.isArray(data.communityRadar.keywords)
            ? data.communityRadar.keywords.map((k) => String(k).trim()).filter(Boolean)
            : (existing.communityRadar?.keywords ?? ["[SLRP]"]),
          gameFilter: typeof data.communityRadar.gameFilter === "string" ? data.communityRadar.gameFilter.trim() : existing.communityRadar?.gameFilter,
          requiredRoleId: typeof data.communityRadar.requiredRoleId === "string" ? data.communityRadar.requiredRoleId.trim() : existing.communityRadar?.requiredRoleId,
          requiredRoleName: typeof data.communityRadar.requiredRoleName === "string" ? data.communityRadar.requiredRoleName.trim() : existing.communityRadar?.requiredRoleName,
          liveRoleId: typeof data.communityRadar.liveRoleId === "string" ? data.communityRadar.liveRoleId.trim() : existing.communityRadar?.liveRoleId,
          liveRoleName: typeof data.communityRadar.liveRoleName === "string" ? data.communityRadar.liveRoleName.trim() : existing.communityRadar?.liveRoleName,
          discordChannelId: typeof data.communityRadar.discordChannelId === "string" ? data.communityRadar.discordChannelId.trim() : existing.communityRadar?.discordChannelId,
          discordChannelName: typeof data.communityRadar.discordChannelName === "string" ? data.communityRadar.discordChannelName.trim() : existing.communityRadar?.discordChannelName,
          pingRoleId: typeof data.communityRadar.pingRoleId === "string" ? data.communityRadar.pingRoleId.trim() : existing.communityRadar?.pingRoleId,
          pingRoleName: typeof data.communityRadar.pingRoleName === "string" ? data.communityRadar.pingRoleName.trim() : existing.communityRadar?.pingRoleName,
          customMessage: typeof data.communityRadar.customMessage === "string" ? data.communityRadar.customMessage.trim().slice(0, 1000) : existing.communityRadar?.customMessage,
          cooldownMinutes: typeof data.communityRadar.cooldownMinutes === "number" ? data.communityRadar.cooldownMinutes : (existing.communityRadar?.cooldownMinutes ?? 360),
          customBranding: typeof data.communityRadar.customBranding === "boolean" ? data.communityRadar.customBranding : existing.communityRadar?.customBranding,
          customFooterText: typeof data.communityRadar.customFooterText === "string" ? data.communityRadar.customFooterText.trim().slice(0, 100) : existing.communityRadar?.customFooterText,
        }
      : (existing.communityRadar ?? DEFAULT_COMMUNITY_RADAR_CONFIG),
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");

  return payload;
}
