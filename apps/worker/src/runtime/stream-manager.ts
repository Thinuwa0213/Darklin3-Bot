import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { ActivityType, EmbedBuilder } from "discord.js";
import type { Logger } from "@creatorcore/logger";
import type { IDiscordClient } from "./discord-client.js";

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
  customUploadMessage?: string | undefined;
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

interface LiveStreamDetails {
  isLive: boolean;
  streamId?: string | undefined;
  title?: string | undefined;
  game?: string | undefined;
  viewers?: number | undefined;
  thumbnailUrl?: string | undefined;
  avatarUrl?: string | undefined;
}

interface VideoUploadDetails {
  videoId: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string | undefined;
  publishedAt?: string | undefined;
}

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute (snappy for testing & production)

export class StreamManager {
  private timer?: NodeJS.Timeout | undefined;
  private presenceListener?: ((...args: unknown[]) => void) | undefined;
  private isDestroyed = false;
  private isChecking = false;
  private twitchAccessToken: string | null = null;
  private twitchTokenExpiresAt = 0;
  private readonly youtubeChannelIdCache = new Map<string, string>();
  private readonly communityCooldowns = new Map<string, number>();

  constructor(
    private readonly client: IDiscordClient,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    this.isDestroyed = false;
    this.logger.info("stream-manager: started content alert & live auto-role service");

    // Gateway presence streaming listener (for autoPresenceRole)
    this.presenceListener = (oldArg: unknown, newArg: unknown) => {
      if (this.isDestroyed) return;
      void this.handlePresenceUpdate(oldArg, newArg);
    };
    this.client.on("presenceUpdate", this.presenceListener);

    setTimeout(() => {
      if (!this.isDestroyed) {
        void this.checkAllStreams();
      }
    }, 10_000);

    this.timer = setInterval(() => {
      if (!this.isDestroyed) {
        void this.checkAllStreams();
      }
    }, CHECK_INTERVAL_MS);
  }

  public stop(): void {
    this.isDestroyed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.presenceListener) {
      this.client.removeListener("presenceUpdate", this.presenceListener);
      this.presenceListener = undefined;
    }
    this.logger.info("stream-manager: stopped content alert & live auto-role service");
  }

  private async resolveStorageDir(): Promise<string | null> {
    const candidates = [
      path.resolve(process.cwd(), "storage", "tenants"),
      path.resolve(process.cwd(), "..", "..", "storage", "tenants"),
    ];

    for (const dir of candidates) {
      try {
        await fs.access(dir);
        return dir;
      } catch {
        // try next
      }
    }
    return null;
  }

  public async checkAllStreams(): Promise<void> {
    if (this.isChecking || this.isDestroyed) return;
    this.isChecking = true;

    try {
      const storageTenantsDir = await this.resolveStorageDir();
      if (!storageTenantsDir) return;

      const tenants = await fs.readdir(storageTenantsDir, { withFileTypes: true });

      for (const tenant of tenants) {
        if (!tenant.isDirectory() || this.isDestroyed) continue;
        const guildsDir = path.join(storageTenantsDir, tenant.name, "guilds");

        let guildEntries: Dirent[] = [];
        try {
          guildEntries = await fs.readdir(guildsDir, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const guildEntry of guildEntries) {
          if (!guildEntry.isDirectory() || this.isDestroyed) continue;
          const streamsFile = path.join(guildsDir, guildEntry.name, "streams.json");

          let config: StoredStreamsConfig;
          try {
            const raw = await fs.readFile(streamsFile, "utf-8");
            config = JSON.parse(raw) as StoredStreamsConfig;
          } catch {
            continue;
          }

          if (!config.enabled || !Array.isArray(config.streamers) || config.streamers.length === 0) {
            continue;
          }

          let configChanged = false;

          for (const streamer of config.streamers) {
            if (this.isDestroyed) break;

            // 1. Check Live Streams
            if (streamer.notifyLive !== false) {
              try {
                const liveDetails = await this.probeLiveStream(streamer);
                const wasLive = streamer.lastStatus === "live";

                // OFFLINE -> LIVE (Send Live alert + Assign Live Auto-Role)
                if (liveDetails.isLive && !wasLive) {
                  this.logger.info("stream-manager: creator went live, dispatching Discord alert", {
                    platform: streamer.platform,
                    channel: streamer.channelName,
                    guildId: guildEntry.name,
                  });

                  const msgId = await this.sendLiveAnnouncement(streamer, liveDetails, config);
                  streamer.lastStatus = "live";
                  streamer.lastStreamId = liveDetails.streamId ?? String(Date.now());
                  streamer.lastMessageId = msgId;
                  streamer.lastCheckedAt = new Date().toISOString();
                  configChanged = true;

                  // Assign Live Role to linked Discord member
                  if (config.liveRoleEnabled && config.liveRoleId && streamer.discordUserId) {
                    await this.assignLiveRole(guildEntry.name, streamer.discordUserId, config.liveRoleId);
                  }
                }
                // LIVE -> OFFLINE (Stream concluded: auto-cleanup + Strip Live Auto-Role)
                else if (!liveDetails.isLive && wasLive) {
                  this.logger.info("stream-manager: creator went offline", {
                    platform: streamer.platform,
                    channel: streamer.channelName,
                    guildId: guildEntry.name,
                  });

                  if (config.autoCleanup && streamer.lastMessageId) {
                    await this.updateOfflineMessage(streamer);
                  }

                  // Strip Live Role from linked Discord member
                  if (config.liveRoleEnabled && config.liveRoleId && streamer.discordUserId) {
                    await this.removeLiveRole(guildEntry.name, streamer.discordUserId, config.liveRoleId);
                  }

                  streamer.lastStatus = "offline";
                  streamer.lastCheckedAt = new Date().toISOString();
                  configChanged = true;
                }
              } catch (err) {
                this.logger.warn("stream-manager: error checking live status", {
                  streamer: streamer.channelName,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }

            // 2. Check Video Uploads (for YouTube & TikTok)
            if (streamer.notifyUploads && (streamer.platform === "youtube" || streamer.platform === "tiktok")) {
              try {
                const uploadDetails = await this.probeLatestVideo(streamer);
                if (uploadDetails && uploadDetails.videoId) {
                  if (!streamer.lastVideoId) {
                    streamer.lastVideoId = uploadDetails.videoId;
                    configChanged = true;
                  } else if (streamer.lastVideoId !== uploadDetails.videoId) {
                    this.logger.info("stream-manager: new video upload detected, dispatching alert", {
                      platform: streamer.platform,
                      channel: streamer.channelName,
                      videoId: uploadDetails.videoId,
                    });

                    await this.sendVideoUploadAnnouncement(
                      streamer,
                      uploadDetails,
                      config,
                    );

                    streamer.lastVideoId = uploadDetails.videoId;
                    configChanged = true;
                  }
                }
              } catch (err) {
                this.logger.warn("stream-manager: error checking video uploads", {
                  streamer: streamer.channelName,
                  platform: streamer.platform,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }

            streamer.lastCheckedAt = new Date().toISOString();
          }

          if (configChanged) {
            try {
              config.updatedAt = new Date().toISOString();
              await fs.writeFile(streamsFile, JSON.stringify(config, null, 2), "utf-8");
            } catch (writeErr) {
              this.logger.error("stream-manager: failed to save updated streams state", {
                guildId: guildEntry.name,
                error: writeErr instanceof Error ? writeErr.message : String(writeErr),
              });
            }
          }
        }
      }
    } catch (err) {
      this.logger.error("stream-manager: unexpected error during checkAllStreams", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Assign Live Auto-Role to a guild member
   */
  private async assignLiveRole(guildId: string, userId: string, roleId: string): Promise<void> {
    try {
      const guild = (await this.client.fetchGuild?.(guildId)) as any;
      if (!guild) return;
      const member = await guild.members.fetch(userId).catch(() => null);
      const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
      if (member && role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        this.logger.info("stream-manager: assigned live auto-role to member", {
          guildId,
          userId,
          roleId,
          roleName: role.name,
        });
      }
    } catch (err) {
      this.logger.warn("stream-manager: failed to assign live auto-role", {
        guildId,
        userId,
        roleId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Remove Live Auto-Role from a guild member
   */
  private async removeLiveRole(guildId: string, userId: string, roleId: string): Promise<void> {
    try {
      const guild = (await this.client.fetchGuild?.(guildId)) as any;
      if (!guild) return;
      const member = await guild.members.fetch(userId).catch(() => null);
      const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
      if (member && role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        this.logger.info("stream-manager: removed live auto-role from member", {
          guildId,
          userId,
          roleId,
          roleName: role.name,
        });
      }
    } catch (err) {
      this.logger.warn("stream-manager: failed to remove live auto-role", {
        guildId,
        userId,
        roleId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Handles Discord Presence updates for autoPresenceRole
   */
  private async handlePresenceUpdate(oldPresenceArg: unknown, newPresenceArg: unknown): Promise<void> {
    if (!newPresenceArg || typeof newPresenceArg !== "object") return;
    const newPresence = newPresenceArg as any;
    const oldPresence = (oldPresenceArg as any) ?? null;

    const guild = newPresence.guild;
    const member = newPresence.member;
    if (!guild || !member) return;

    try {
      const storageTenantsDir = await this.resolveStorageDir();
      if (!storageTenantsDir) return;

      const tenants = await fs.readdir(storageTenantsDir, { withFileTypes: true });
      for (const tenant of tenants) {
        if (!tenant.isDirectory()) continue;
        const streamsFile = path.join(storageTenantsDir, tenant.name, "guilds", guild.id, "streams.json");

        let config: StoredStreamsConfig;
        try {
          const raw = await fs.readFile(streamsFile, "utf-8");
          config = JSON.parse(raw) as StoredStreamsConfig;
        } catch {
          continue;
        }

        if (!config.enabled) continue;

        // 1. Basic autoPresenceRole (Global unconditional streaming)
        if (config.liveRoleEnabled && config.autoPresenceRole && config.liveRoleId) {
          const isNowStreaming = Array.isArray(newPresence.activities) &&
            newPresence.activities.some((act: any) => act.type === ActivityType.Streaming || act.type === 1);

          const wasStreaming = oldPresence && Array.isArray(oldPresence.activities) &&
            oldPresence.activities.some((act: any) => act.type === ActivityType.Streaming || act.type === 1);

          if (isNowStreaming && !wasStreaming) {
            await this.assignLiveRole(guild.id, member.id, config.liveRoleId);
          } else if (!isNowStreaming && wasStreaming) {
            await this.removeLiveRole(guild.id, member.id, config.liveRoleId);
          }
        }

        // 2. Community Stream Radar (Keyword + Game Category + Member Role + Cooldown Announcement)
        if (config.communityRadar && config.communityRadar.enabled) {
          await this.handleCommunityRadarPresence(guild, member, oldPresence, newPresence, config.communityRadar);
        }
      }
    } catch (err) {
      this.logger.debug?.("stream-manager: presence update error", { err });
    }
  }

  /**
   * Evaluates Community Stream Radar rules:
   * Title Keywords + Game Category + Required Member Role + Discord Alert + Auto-Role
   */
  private async handleCommunityRadarPresence(
    guild: any,
    member: any,
    oldPresence: any,
    newPresence: any,
    radar: CommunityRadarConfig,
  ): Promise<void> {
    try {
      const streamingActivity = Array.isArray(newPresence.activities)
        ? newPresence.activities.find((act: any) => act.type === ActivityType.Streaming || act.type === 1)
        : null;

      const wasStreamingActivity = oldPresence && Array.isArray(oldPresence.activities)
        ? oldPresence.activities.find((act: any) => act.type === ActivityType.Streaming || act.type === 1)
        : null;

      if (!streamingActivity) {
        if (radar.liveRoleId && wasStreamingActivity) {
          await this.removeLiveRole(guild.id, member.id, radar.liveRoleId);
        }
        return;
      }

      if (radar.requiredRoleId && !member.roles?.cache?.has(radar.requiredRoleId)) {
        return;
      }

      const streamTitle = (
        streamingActivity.details ||
        streamingActivity.state ||
        streamingActivity.name ||
        ""
      ).trim();

      const gameName = (streamingActivity.name || streamingActivity.assets?.largeText || "Live Broadcast").trim();
      const streamUrl = streamingActivity.url || "";

      let matchesKeyword = true;
      let matchedKeyword = "";
      if (Array.isArray(radar.keywords) && radar.keywords.length > 0) {
        const titleLower = streamTitle.toLowerCase();
        const found = radar.keywords.find((kw) => kw.trim() && titleLower.includes(kw.trim().toLowerCase()));
        if (!found) {
          matchesKeyword = false;
        } else {
          matchedKeyword = found.trim();
        }
      }

      if (!matchesKeyword) {
        if (radar.liveRoleId) {
          await this.removeLiveRole(guild.id, member.id, radar.liveRoleId);
        }
        return;
      }

      if (radar.gameFilter && radar.gameFilter.trim()) {
        const gameLower = gameName.toLowerCase();
        const filterLower = radar.gameFilter.trim().toLowerCase();
        if (!gameLower.includes(filterLower)) {
          if (radar.liveRoleId) {
            await this.removeLiveRole(guild.id, member.id, radar.liveRoleId);
          }
          return;
        }
      }

      if (radar.liveRoleId) {
        await this.assignLiveRole(guild.id, member.id, radar.liveRoleId);
      }

      if (radar.discordChannelId) {
        const cooldownKey = `${guild.id}:${member.id}`;
        const lastAlertAt = this.communityCooldowns.get(cooldownKey) ?? 0;
        const cooldownMinutes = radar.cooldownMinutes ?? 360;
        const cooldownMs = cooldownMinutes * 60 * 1000;
        const now = Date.now();

        if (now - lastAlertAt >= cooldownMs) {
          this.communityCooldowns.set(cooldownKey, now);

          await this.dispatchCommunityRadarAlert(guild, member, {
            streamTitle: streamTitle || `${member.displayName || member.user?.username} is streaming ${gameName}!`,
            gameName,
            streamUrl,
            matchedKeyword: matchedKeyword || radar.keywords?.[0] || "",
            radar,
          });
        }
      }
    } catch (err) {
      this.logger.warn("stream-manager: error processing community radar presence", {
        guildId: guild.id,
        memberId: member.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Dispatches Rich Embed community alert to target Discord channel
   */
  private async dispatchCommunityRadarAlert(
    guild: any,
    member: any,
    data: {
      streamTitle: string;
      gameName: string;
      streamUrl: string;
      matchedKeyword: string;
      radar: CommunityRadarConfig;
    },
  ): Promise<void> {
    try {
      const channel = (await this.client.fetchChannel?.(data.radar.discordChannelId!)) as any;
      if (!channel || typeof channel.send !== "function") return;

      const memberName = member.displayName || member.user?.username || "Community Member";
      const userAvatar = member.displayAvatarURL?.() || member.user?.displayAvatarURL?.();

      let pingContent = "";
      if (data.radar.pingRoleId === "everyone") {
        pingContent = "@everyone";
      } else if (data.radar.pingRoleId === "here") {
        pingContent = "@here";
      } else if (data.radar.pingRoleId && data.radar.pingRoleId !== "none") {
        pingContent = `<@&${data.radar.pingRoleId}>`;
      }

      const template = data.radar.customMessage || "🎮 **{member}** is streaming **{game}** with **{keyword}**!\nCome hang out: {url}";
      const formattedDesc = template
        .replace(/{member}/g, memberName)
        .replace(/{game}/g, data.gameName)
        .replace(/{keyword}/g, data.matchedKeyword || "Community Tag")
        .replace(/{url}/g, data.streamUrl || "");

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(data.streamTitle)
        .setDescription(formattedDesc);

      if (data.radar.customBranding) {
        if (data.radar.customFooterText) {
          embed.setFooter({ text: data.radar.customFooterText });
        }
      } else {
        embed.setFooter({ text: "⚡ Community Radar powered by CreatorCore • creatorcore.app" });
      }
      embed.setTimestamp();

      if (data.streamUrl) {
        embed.setAuthor({
          name: `${memberName} is live with ${data.matchedKeyword || "Community"} tag!`,
          iconURL: userAvatar,
          url: data.streamUrl,
        });
        embed.setURL(data.streamUrl);
      } else {
        embed.setAuthor({
          name: `${memberName} is live with ${data.matchedKeyword || "Community"} tag!`,
          iconURL: userAvatar,
        });
      }

      if (data.streamUrl && data.streamUrl.includes("twitch.tv/")) {
        const twitchUsername = data.streamUrl.split("twitch.tv/")[1]?.replace(/[^a-zA-Z0-9_]/g, "");
        if (twitchUsername) {
          embed.setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${twitchUsername.toLowerCase()}-1280x720.jpg`);
        }
      }

      await channel.send({
        content: pingContent || undefined,
        embeds: [embed],
      });

      this.logger.info("stream-manager: dispatched community radar alert", {
        guildId: guild.id,
        member: memberName,
        game: data.gameName,
        channelId: data.radar.discordChannelId,
      });
    } catch (err) {
      this.logger.error("stream-manager: failed to dispatch community radar alert", {
        guildId: guild.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Probe Live Status across Kick, Twitch, YouTube, and TikTok
   */
  private async probeLiveStream(streamer: StoredStreamerAlert): Promise<LiveStreamDetails> {
    switch (streamer.platform) {
      case "kick":
        return this.probeKick(streamer.channelName);
      case "twitch":
        return this.probeTwitch(streamer.channelName);
      case "youtube":
        return this.probeYouTubeLive(streamer.channelName);
      case "tiktok":
        return this.probeTikTokLive(streamer.channelName);
      default:
        return { isLive: false };
    }
  }

  /**
   * Kick Live Detection via public API
   */
  private async probeKick(channelSlug: string): Promise<LiveStreamDetails> {
    const cleanSlug = channelSlug.replace(/[@#]/g, "").trim().toLowerCase();
    const url = `https://kick.com/api/v2/channels/${encodeURIComponent(cleanSlug)}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0",
          Accept: "application/json",
        },
      });

      if (!res.ok) return { isLive: false };

      const data = (await res.json()) as any;
      if (data && data.livestream && data.livestream.id) {
        return {
          isLive: true,
          streamId: String(data.livestream.id),
          title: data.livestream.session_title || `${data.user?.username ?? cleanSlug} is LIVE on Kick!`,
          game: data.livestream.categories?.[0]?.name ?? "Just Chatting",
          viewers: data.livestream.viewer_count ?? 0,
          thumbnailUrl: data.livestream.thumbnail?.url,
          avatarUrl: data.user?.profile_pic,
        };
      }
    } catch (err) {
      this.logger.debug?.("stream-manager: kick fetch error", { channelSlug, err });
    }

    return { isLive: false };
  }

  /**
   * Twitch Live Detection via Helix or public GQL probe
   */
  private async probeTwitch(channelLogin: string): Promise<LiveStreamDetails> {
    const cleanLogin = channelLogin.replace(/[@#]/g, "").trim().toLowerCase();
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    // 1. Try official Helix API if credentials provided
    if (clientId && clientSecret) {
      try {
        const token = await this.getTwitchAppToken(clientId, clientSecret);
        if (token) {
          const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(cleanLogin)}`, {
            headers: {
              "Client-ID": clientId,
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const json = (await res.json()) as any;
            if (json.data && json.data.length > 0) {
              const stream = json.data[0];
              return {
                isLive: true,
                streamId: String(stream.id),
                title: stream.title || `${cleanLogin} is LIVE on Twitch!`,
                game: stream.game_name || "Twitch Stream",
                viewers: stream.viewer_count ?? 0,
                thumbnailUrl: stream.thumbnail_url
                  ? stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720")
                  : undefined,
              };
            }
          }
        }
      } catch (err) {
        this.logger.debug?.("stream-manager: twitch helix error", { cleanLogin, err });
      }
    }

    // 2. Public Twitch GQL Fallback (works out-of-the-box without credentials!)
    try {
      const gqlRes = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
          "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0",
        },
        body: JSON.stringify({
          query: `query { user(login: "${cleanLogin}") { displayName stream { id title type game { name } viewersCount previewImageURL(width: 1280, height: 720) } } }`,
        }),
      });

      if (gqlRes.ok) {
        const gqlData = (await gqlRes.json()) as any;
        const stream = gqlData?.data?.user?.stream;
        if (stream && (stream.type === "live" || stream.id)) {
          return {
            isLive: true,
            streamId: String(stream.id),
            title: stream.title || `${cleanLogin} is LIVE on Twitch!`,
            game: stream.game?.name || "Twitch Stream",
            viewers: stream.viewersCount ?? 0,
            thumbnailUrl: stream.previewImageURL || undefined,
          };
        }
      }
    } catch (gqlErr) {
      this.logger.debug?.("stream-manager: twitch gql probe error", { cleanLogin, gqlErr });
    }

    return { isLive: false };
  }

  private async getTwitchAppToken(clientId: string, clientSecret: string): Promise<string | null> {
    const now = Date.now();
    if (this.twitchAccessToken && this.twitchTokenExpiresAt > now + 60_000) {
      return this.twitchAccessToken;
    }

    try {
      const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        this.twitchAccessToken = data.access_token;
        this.twitchTokenExpiresAt = now + (data.expires_in ?? 3600) * 1000;
        return this.twitchAccessToken;
      }
    } catch {
      // Token fetch failed
    }
    return null;
  }

  /**
   * YouTube Live Detection
   */
  private async probeYouTubeLive(channelHandle: string): Promise<LiveStreamDetails> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const cleanHandle = channelHandle.trim();

    // 1. If API key exists, try official API
    if (apiKey) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&eventType=live&type=video&q=${encodeURIComponent(cleanHandle)}&key=${apiKey}`;
        const res = await fetch(searchUrl);
        if (res.ok) {
          const json = (await res.json()) as any;
          if (json.items && json.items.length > 0) {
            const item = json.items[0];
            return {
              isLive: true,
              streamId: item.id?.videoId,
              title: item.snippet?.title || `${cleanHandle} is LIVE on YouTube!`,
              game: "YouTube Live",
              thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
            };
          }
        }
      } catch (err) {
        this.logger.debug?.("stream-manager: youtube live api error", { cleanHandle, err });
      }
    }

    // 2. Public live stream inspection fallback (works out-of-the-box!)
    try {
      const liveUrl = cleanHandle.startsWith("@")
        ? `https://www.youtube.com/${encodeURIComponent(cleanHandle)}/live`
        : cleanHandle.startsWith("UC")
          ? `https://www.youtube.com/channel/${encodeURIComponent(cleanHandle)}/live`
          : `https://www.youtube.com/@${encodeURIComponent(cleanHandle.replace("@", ""))}/live`;

      const res = await fetch(liveUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0",
          Accept: "text/html",
        },
        redirect: "follow",
      });

      if (res.ok) {
        const html = await res.text();
        const isLive = html.includes('"status":"LIVE"') || (html.includes('"isLive":true') && html.includes("liveStreamabilityRenderer"));
        if (isLive) {
          const videoIdMatch = html.match(/"videoId":"([^"]+)"/);
          const titleMatch = html.match(/<title>([^<]+)<\/title>/);
          const streamTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(" - YouTube", "").trim() : `${cleanHandle} is LIVE on YouTube!`;

          return {
            isLive: true,
            streamId: videoIdMatch ? videoIdMatch[1] : `yt-${Date.now()}`,
            title: streamTitle,
            game: "YouTube Live",
            thumbnailUrl: videoIdMatch ? `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg` : undefined,
          };
        }
      }
    } catch (err) {
      this.logger.debug?.("stream-manager: youtube public live probe error", { cleanHandle, err });
    }

    return { isLive: false };
  }

  /**
   * TikTok Live Detection
   */
  private async probeTikTokLive(channelHandle: string): Promise<LiveStreamDetails> {
    const cleanHandle = channelHandle.replace("@", "").trim();
    try {
      const res = await fetch(`https://www.tiktok.com/@${cleanHandle}/live`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0",
        },
      });

      if (res.ok) {
        const html = await res.text();
        if (html.includes('"liveRoom"') && html.includes('"status":2')) {
          return {
            isLive: true,
            streamId: `tiktok-${cleanHandle}-${Date.now()}`,
            title: `🔴 @${cleanHandle} is LIVE on TikTok!`,
            game: "TikTok LIVE",
          };
        }
      }
    } catch (err) {
      this.logger.debug?.("stream-manager: tiktok live probe error", { cleanHandle, err });
    }

    return { isLive: false };
  }

  /**
   * Probe Latest Video Upload (YouTube & TikTok)
   */
  private async probeLatestVideo(streamer: StoredStreamerAlert): Promise<VideoUploadDetails | null> {
    if (streamer.platform === "youtube") {
      return this.probeYouTubeLatestVideo(streamer.channelName);
    }
    if (streamer.platform === "tiktok") {
      return this.probeTikTokLatestVideo(streamer.channelName);
    }
    return null;
  }

  /**
   * YouTube Latest Video Probe via public RSS / feed
   */
  private async probeYouTubeLatestVideo(channelHandle: string): Promise<VideoUploadDetails | null> {
    const cleanHandle = channelHandle.trim();

    try {
      let channelId = this.youtubeChannelIdCache.get(cleanHandle);

      if (!channelId && cleanHandle.startsWith("UC")) {
        channelId = cleanHandle;
      }

      // If handle (@name), resolve to UC... channelId
      if (!channelId) {
        try {
          const handleUrl = cleanHandle.startsWith("@")
            ? `https://www.youtube.com/${encodeURIComponent(cleanHandle)}`
            : `https://www.youtube.com/@${encodeURIComponent(cleanHandle)}`;

          const handleRes = await fetch(handleUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0" },
          });

          if (handleRes.ok) {
            const handleHtml = await handleRes.text();
            const idMatch = handleHtml.match(/<meta itemprop="channelId" content="([^"]+)">/) ||
                            handleHtml.match(/"channelId":"([^"]+)"/);
            if (idMatch && idMatch[1]) {
              channelId = idMatch[1];
              this.youtubeChannelIdCache.set(cleanHandle, channelId);
            }
          }
        } catch {
          // fallback
        }
      }

      const feedUrl = channelId
        ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
        : `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(cleanHandle.replace("@", ""))}`;

      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0" },
      });

      if (res.ok) {
        const xml = await res.text();
        const idMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        const titleMatch = xml.match(/<title>([^<]+)<\/title>/g);

        if (idMatch && idMatch[1]) {
          const videoId = idMatch[1];
          const rawTitle = titleMatch && titleMatch.length > 1 ? titleMatch[1]?.replace(/<\/?title>/g, "") : "New Video";

          return {
            videoId,
            title: rawTitle ?? "New Video",
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };
        }
      }
    } catch (err) {
      this.logger.debug?.("stream-manager: youtube rss error", { channelHandle, err });
    }

    return null;
  }

  /**
   * TikTok Latest Video Probe
   */
  private async probeTikTokLatestVideo(channelHandle: string): Promise<VideoUploadDetails | null> {
    const cleanHandle = channelHandle.replace("@", "").trim();

    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${encodeURIComponent(cleanHandle)}`;
      const res = await fetch(oembedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorCore/1.0" },
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && data.title) {
          return {
            videoId: `tt-${encodeURIComponent(cleanHandle)}-${data.author_name}`,
            title: data.title || `New TikTok from @${cleanHandle}`,
            videoUrl: `https://www.tiktok.com/@${cleanHandle}`,
            thumbnailUrl: data.thumbnail_url,
          };
        }
      }
    } catch (err) {
      this.logger.debug?.("stream-manager: tiktok latest video probe error", { cleanHandle, err });
    }

    return null;
  }

  /**
   * Send Rich Embed announcement for Live Streams
   * Clean, professional layout (direct watch link, clickable stream title, 16:9 banner, no fake fields)
   */
  private async sendLiveAnnouncement(
    streamer: StoredStreamerAlert,
    details: LiveStreamDetails,
    config: StoredStreamsConfig,
  ): Promise<string | null> {
    if (!streamer.discordChannelId) return null;

    try {
      const channel = (await this.client.fetchChannel?.(streamer.discordChannelId)) as any;
      if (!channel || typeof channel.send !== "function") return null;

      const colorMap = {
        twitch: 0x9146ff,
        youtube: 0xff0000,
        kick: 0x53fc18,
        tiktok: 0xfe2c55,
      };
      const embedColor = colorMap[streamer.platform] ?? 0x5865f2;

      let pingRoleText = "";
      if (streamer.pingRoleId === "everyone") {
        pingRoleText = "@everyone";
      } else if (streamer.pingRoleId === "here") {
        pingRoleText = "@here";
      } else if (streamer.pingRoleId && streamer.pingRoleId !== "none") {
        pingRoleText = `<@&${streamer.pingRoleId}>`;
      }

      // Determine direct stream watch link
      let directUrl = streamer.channelUrl;
      if (streamer.platform === "youtube" && details.streamId && !details.streamId.startsWith("yt-")) {
        directUrl = `https://www.youtube.com/watch?v=${details.streamId}`;
      }

      // Message text above the embed
      let content = "";
      if (config.customLiveMessage && config.customLiveMessage.trim()) {
        content = config.customLiveMessage
          .replace(/{streamer}/g, streamer.channelName)
          .replace(/{game}/g, details.game || "")
          .replace(/{url}/g, directUrl)
          .replace(/{role}/g, pingRoleText);

        if (pingRoleText && !content.includes(pingRoleText)) {
          content = `${pingRoleText} ${content}`;
        }
      } else {
        content = `Hey ${pingRoleText ? pingRoleText + " " : ""}**${streamer.channelName}** is going to be live soon!\n${directUrl}`;
      }

      const platformNames: Record<string, string> = {
        twitch: "Twitch",
        youtube: "YouTube",
        kick: "Kick",
        tiktok: "TikTok",
      };
      const platformName = platformNames[streamer.platform] ?? "Live";

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
          name: `${platformName} • ${streamer.channelName}`,
          url: directUrl,
          ...(details.avatarUrl ? { iconURL: details.avatarUrl } : {}),
        })
        .setTitle(details.title || `${streamer.channelName} is LIVE!`)
        .setURL(directUrl);

      // Only add real game category for Twitch/Kick (avoid fake "YouTube Live" category)
      if (
        details.game &&
        details.game !== "YouTube Live" &&
        details.game !== "Live Broadcast" &&
        details.game !== "TikTok LIVE"
      ) {
        embed.addFields({ name: "Category", value: details.game, inline: true });
      }

      // Only add viewers if real numeric count exists
      if (typeof details.viewers === "number" && details.viewers > 0) {
        embed.addFields({
          name: "Viewers",
          value: `${details.viewers.toLocaleString()} watching`,
          inline: true,
        });
      }

      // High-res 16:9 Banner Image (without letterbox black bars)
      if (details.thumbnailUrl) {
        embed.setImage(details.thumbnailUrl);
      } else if (streamer.platform === "youtube" && details.streamId && !details.streamId.startsWith("yt-")) {
        embed.setImage(`https://i.ytimg.com/vi/${details.streamId}/maxresdefault.jpg`);
      } else if (streamer.platform === "twitch") {
        const cleanTwitch = streamer.channelName.toLowerCase().replace(/[@#]/g, "");
        embed.setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${cleanTwitch}-1280x720.jpg`);
      }

      // Branding & Watermark (Free = CreatorCore branding, PRO = white-label / custom)
      if (config.customBranding) {
        if (config.customFooterText) {
          embed.setFooter({ text: config.customFooterText });
        }
      } else {
        embed.setFooter({
          text: "⚡ Stream Alert powered by CreatorCore • creatorcore.app",
        });
      }
      embed.setTimestamp();

      const sentMsg = await channel.send({
        content: content.trim() || undefined,
        embeds: [embed],
      });

      return sentMsg?.id ?? null;
    } catch (err) {
      this.logger.error("stream-manager: failed to dispatch Discord live alert", {
        streamerId: streamer.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Send Rich Embed announcement for New Video Uploads
   */
  private async sendVideoUploadAnnouncement(
    streamer: StoredStreamerAlert,
    video: VideoUploadDetails,
    config: StoredStreamsConfig,
  ): Promise<string | null> {
    if (!streamer.discordChannelId) return null;

    try {
      const channel = (await this.client.fetchChannel?.(streamer.discordChannelId)) as any;
      if (!channel || typeof channel.send !== "function") return null;

      const embedColor = streamer.platform === "tiktok" ? 0xfe2c55 : 0xff0000;

      let pingRoleText = "";
      if (streamer.pingRoleId === "everyone") {
        pingRoleText = "@everyone";
      } else if (streamer.pingRoleId === "here") {
        pingRoleText = "@here";
      } else if (streamer.pingRoleId && streamer.pingRoleId !== "none") {
        pingRoleText = `<@&${streamer.pingRoleId}>`;
      }

      const template = config.customUploadMessage;
      let content = "";
      if (template && template.trim()) {
        content = template
          .replace(/{streamer}/g, streamer.channelName)
          .replace(/{title}/g, video.title)
          .replace(/{url}/g, video.videoUrl)
          .replace(/{role}/g, pingRoleText);

        if (pingRoleText && !content.includes(pingRoleText)) {
          content = `${pingRoleText} ${content}`;
        }
      } else {
        content = `🎬 **${streamer.channelName}** just uploaded a new video!\n${video.videoUrl}`;
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
          name: `${streamer.platform === "youtube" ? "YouTube" : "TikTok"} • ${streamer.channelName}`,
          url: video.videoUrl,
        })
        .setTitle(video.title)
        .setURL(video.videoUrl);

      // Large 16:9 Video Thumbnail Banner
      if (video.thumbnailUrl) {
        embed.setImage(video.thumbnailUrl);
      } else if (streamer.platform === "youtube" && video.videoId) {
        embed.setImage(`https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`);
      }

      // Branding & Watermark
      if (config.customBranding) {
        if (config.customFooterText) {
          embed.setFooter({ text: config.customFooterText });
        }
      } else {
        embed.setFooter({
          text: "⚡ Video Alert powered by CreatorCore • creatorcore.app",
        });
      }
      embed.setTimestamp();

      const sentMsg = await channel.send({
        content: content.trim() || undefined,
        embeds: [embed],
      });

      return sentMsg?.id ?? null;
    } catch (err) {
      this.logger.error("stream-manager: failed to dispatch video upload alert", {
        streamerId: streamer.id,
        videoId: video.videoId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Updates original Discord message when stream concludes (Auto-Cleanup)
   */
  private async updateOfflineMessage(streamer: StoredStreamerAlert): Promise<void> {
    if (!streamer.discordChannelId || !streamer.lastMessageId) return;

    try {
      const channel = (await this.client.fetchChannel?.(streamer.discordChannelId)) as any;
      if (!channel || typeof channel.messages?.fetch !== "function") return;

      const message = await channel.messages.fetch(streamer.lastMessageId);
      if (!message) return;

      const offlineEmbed = new EmbedBuilder()
        .setColor(0x747f8d) // Discord offline gray
        .setTitle(`🔴 [STREAM ENDED] ${streamer.channelName} was live`)
        .setDescription(
          `This broadcast has concluded. Thanks for watching!\nCatch the next stream at [${streamer.channelUrl}](${streamer.channelUrl})`,
        )
        .addFields({ name: "Status", value: "Offline", inline: true })
        .setTimestamp();

      await message.edit({
        content: null,
        embeds: [offlineEmbed],
      });

      this.logger.info("stream-manager: auto-cleaned offline stream announcement", {
        messageId: streamer.lastMessageId,
        streamer: streamer.channelName,
      });
    } catch (err) {
      this.logger.debug?.("stream-manager: unable to edit offline message", {
        messageId: streamer.lastMessageId,
        err,
      });
    }
  }
}
