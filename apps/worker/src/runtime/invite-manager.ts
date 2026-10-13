import fs from "node:fs/promises";
import path from "node:path";
import { EmbedBuilder, type GuildMember } from "discord.js";
import type { Logger } from "@creatorcore/logger";
import type { IDiscordClient } from "./discord-client.js";
import { logToGuildConsole } from "./guild-console-logger.js";

export interface StoredInvitesConfig {
  enabled: boolean;
  channelId?: string | undefined;
  channelName?: string | undefined;
  trackVanity: boolean;
  trackBots: boolean;
  protectFakes: boolean;
  fakeAccountAgeDays: number;
  joinMessage: string;
  leaveMessage: string;
  fakeJoinMessage: string;
  unknownJoinMessage: string;
  recentJoins?: Array<{
    id: string;
    userId: string;
    userTag: string;
    userAvatar?: string | undefined;
    inviterId?: string | undefined;
    inviterTag?: string | undefined;
    inviteCode?: string | undefined;
    channelId?: string | undefined;
    channelName?: string | undefined;
    uses?: number | undefined;
    accountAgeDays: number;
    isFake: boolean;
    isBot: boolean;
    timestamp: string;
  }> | undefined;
}

export class InviteManager {
  private isDestroyed = false;
  // Map<guildId, Map<inviteCode, uses>>
  private readonly inviteCache = new Map<string, Map<string, number>>();
  private memberAddListener?: ((...args: unknown[]) => void) | undefined;
  private memberRemoveListener?: ((...args: unknown[]) => void) | undefined;
  private inviteCreateListener?: ((...args: unknown[]) => void) | undefined;
  private inviteDeleteListener?: ((...args: unknown[]) => void) | undefined;

  constructor(
    public readonly client: IDiscordClient,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    this.isDestroyed = false;

    // Cache initial invites for all accessible guilds
    const anyClient = this.client as any;
    if (anyClient.guilds?.cache) {
      for (const guild of anyClient.guilds.cache.values()) {
        void this.cacheGuildInvites(guild);
      }
    }

    // Keep cache synchronized on invite creation
    this.inviteCreateListener = (inviteRaw: unknown) => {
      const invite = inviteRaw as any;
      if (this.isDestroyed || !invite?.guild?.id || !invite?.code) return;
      const guildMap = this.inviteCache.get(invite.guild.id) ?? new Map<string, number>();
      guildMap.set(invite.code, invite.uses || 0);
      this.inviteCache.set(invite.guild.id, guildMap);
    };
    this.client.on("inviteCreate", this.inviteCreateListener);

    // Keep cache synchronized on invite deletion
    this.inviteDeleteListener = (inviteRaw: unknown) => {
      const invite = inviteRaw as any;
      if (this.isDestroyed || !invite?.guild?.id || !invite?.code) return;
      const guildMap = this.inviteCache.get(invite.guild.id);
      if (guildMap) {
        guildMap.delete(invite.code);
      }
    };
    this.client.on("inviteDelete", this.inviteDeleteListener);

    // Track member joins
    this.memberAddListener = (memberRaw: unknown) => {
      void this.handleMemberAdd(memberRaw as GuildMember);
    };
    this.client.on("guildMemberAdd", this.memberAddListener);

    // Track member leaves
    this.memberRemoveListener = (memberRaw: unknown) => {
      void this.handleMemberRemove(memberRaw as GuildMember);
    };
    this.client.on("guildMemberRemove", this.memberRemoveListener);

    this.logger.info("invite-manager: started and listening for invite events");
  }

  public stop(): void {
    this.isDestroyed = true;
    if (this.inviteCreateListener) {
      this.client.removeListener("inviteCreate", this.inviteCreateListener);
      this.inviteCreateListener = undefined;
    }
    if (this.inviteDeleteListener) {
      this.client.removeListener("inviteDelete", this.inviteDeleteListener);
      this.inviteDeleteListener = undefined;
    }
    if (this.memberAddListener) {
      this.client.removeListener("guildMemberAdd", this.memberAddListener);
      this.memberAddListener = undefined;
    }
    if (this.memberRemoveListener) {
      this.client.removeListener("guildMemberRemove", this.memberRemoveListener);
      this.memberRemoveListener = undefined;
    }
    this.inviteCache.clear();
  }

  private async cacheGuildInvites(guild: any): Promise<void> {
    try {
      if (!guild?.invites?.fetch) return;
      const fetched = await guild.invites.fetch().catch(() => null);
      if (!fetched) return;

      const codeMap = new Map<string, number>();
      for (const inv of fetched.values()) {
        codeMap.set(inv.code, inv.uses || 0);
      }
      this.inviteCache.set(guild.id, codeMap);
    } catch {
      // Best-effort caching
    }
  }

  private resolveStorageTenantsDir(): string {
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

  private async findInvitesConfig(guildId: string): Promise<{ tenantId: string; config: StoredInvitesConfig } | null> {
    try {
      const tenantsDir = this.resolveStorageTenantsDir();
      const tenants = await fs.readdir(tenantsDir, { withFileTypes: true }).catch(() => []);
      for (const t of tenants) {
        if (!t.isDirectory()) continue;
        const confPath = path.join(tenantsDir, t.name, "guilds", guildId, "invites.json");
        try {
          const raw = await fs.readFile(confPath, "utf-8");
          const parsed = JSON.parse(raw) as StoredInvitesConfig;
          return { tenantId: t.name, config: parsed };
        } catch {
          // not in this tenant
        }
      }
    } catch {
      // silent
    }
    return null;
  }

  private async handleMemberAdd(member: GuildMember): Promise<void> {
    if (this.isDestroyed || !member?.guild) return;
    const guild = member.guild;

    const record = await this.findInvitesConfig(guild.id);
    if (!record || !record.config.enabled || !record.config.channelId) {
      return;
    }
    const { tenantId, config } = record;

    // Check bot setting
    if (member.user?.bot && !config.trackBots) {
      return;
    }

    // Find used invite
    let matchedInvite: any = null;
    let inviterUser: any = null;
    let totalUses = 1;

    try {
      const currentInvites = await (guild.invites?.fetch ? guild.invites.fetch() : Promise.resolve(null)).catch(() => null);
      const cachedMap = this.inviteCache.get(guild.id);

      if (currentInvites && cachedMap) {
        for (const [code, inv] of currentInvites.entries()) {
          const oldUses = cachedMap.get(code) || 0;
          if ((inv.uses || 0) > oldUses) {
            matchedInvite = inv;
            inviterUser = inv.inviter;
            totalUses = inv.uses || 1;
            break;
          }
        }

        // Update cache with fresh snapshot
        const newMap = new Map<string, number>();
        for (const [code, inv] of currentInvites.entries()) {
          newMap.set(code, inv.uses || 0);
        }
        this.inviteCache.set(guild.id, newMap);
      }
    } catch (err) {
      this.logger.warn("invite-manager: error resolving invite code", {
        guildId: guild.id,
        memberId: member.id,
        error: String(err),
      });
    }

    // Compute Account Age
    const createdMs = member.user?.createdTimestamp || Date.now();
    const accountAgeDays = Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
    const fakeAgeThreshold = config.fakeAccountAgeDays || 7;
    const isFake = Boolean(config.protectFakes && accountAgeDays < fakeAgeThreshold && !member.user?.bot);

    // Format Message Content
    const memberMention = `<@${member.id}>`;
    const memberTag = member.user?.tag || member.user?.username || "UnknownUser";
    const inviterMention = inviterUser ? `<@${inviterUser.id}>` : (matchedInvite?.code ? "Direct/Vanity" : "Unknown");
    const inviterTag = inviterUser?.tag || inviterUser?.username || "Unknown";
    const inviteCode = matchedInvite?.code || "Direct Join";
    const channelName = matchedInvite?.channel?.name || "Server";

    // Construct Discord Embed matching Option 1 (Image 1)
    const isVanity = !matchedInvite && !inviterUser;
    const embedColor = isFake ? 0xed4245 : member.user?.bot ? 0x5865f2 : 0x23a55a;
    const embedTitle = isFake
      ? "⚠️ Suspected Alt/Fake Account Joined!"
      : member.user?.bot
        ? "🤖 New Bot Added to Server!"
        : "New Member Joined!";

    const memberDetailsLines = [
      `• ${memberMention}`,
      `• Username: \`${member.user?.username || memberTag}\``,
      `• User ID: \`${member.id}\``,
    ];
    if (isFake) {
      memberDetailsLines.push(`• Account Age: \`${accountAgeDays} days old\` ⚠️ (Flagged)`);
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: "👤 Joined Member's Details",
        value: memberDetailsLines.join("\n"),
        inline: false,
      },
    ];

    if (inviterUser) {
      fields.push({
        name: "👥 Invited By",
        value: [
          `• ${inviterMention}`,
          `• Username: \`${inviterUser.username || inviterTag}\``,
          `• User ID: \`${inviterUser.id}\``,
        ].join("\n"),
        inline: false,
      });
    } else if (isVanity) {
      fields.push({
        name: "👥 Invited By",
        value: "• Vanity URL / Direct Server Link",
        inline: false,
      });
    } else {
      fields.push({
        name: "👥 Invited By",
        value: "• Direct Join / Unknown",
        inline: false,
      });
    }

    const inviteLinkLines: string[] = [];
    if (matchedInvite?.code) {
      inviteLinkLines.push(`• Code: [${matchedInvite.code}](https://discord.gg/${matchedInvite.code})`);
      if (matchedInvite.channel?.id) {
        inviteLinkLines.push(`• Channel: <#${matchedInvite.channel.id}>`);
      } else if (channelName) {
        inviteLinkLines.push(`• Channel: #${channelName}`);
      }
      if (matchedInvite.createdTimestamp) {
        inviteLinkLines.push(`• Created at: <t:${Math.floor(matchedInvite.createdTimestamp / 1000)}:f>`);
      } else if (matchedInvite.createdAt) {
        const ts = Math.floor(new Date(matchedInvite.createdAt).getTime() / 1000);
        inviteLinkLines.push(`• Created at: <t:${ts}:f>`);
      }
      if (matchedInvite.expiresTimestamp) {
        inviteLinkLines.push(`• Expires at: <t:${Math.floor(matchedInvite.expiresTimestamp / 1000)}:R>`);
      } else if (matchedInvite.maxAge && matchedInvite.maxAge > 0 && matchedInvite.createdTimestamp) {
        const expTs = Math.floor((matchedInvite.createdTimestamp + matchedInvite.maxAge * 1000) / 1000);
        inviteLinkLines.push(`• Expires at: <t:${expTs}:R>`);
      } else {
        inviteLinkLines.push("• Expires at: `∞`");
      }
      const maxUsesStr = matchedInvite.maxUses && matchedInvite.maxUses > 0 ? String(matchedInvite.maxUses) : "∞";
      inviteLinkLines.push(`• Uses: \`${totalUses} / ${maxUsesStr}\``);
    } else if (isVanity) {
      inviteLinkLines.push("• Code: `Vanity URL`");
      inviteLinkLines.push("• Type: Server Custom Vanity Link");
      inviteLinkLines.push(`• Uses: \`${guild.vanityURLUses ?? totalUses} / ∞\``);
    } else {
      inviteLinkLines.push("• Code: `Direct Join`");
      inviteLinkLines.push("• Type: Direct / Widget");
    }

    fields.push({
      name: "🔗 Invite Link's Details",
      value: inviteLinkLines.join("\n"),
      inline: false,
    });

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(embedTitle)
      .setThumbnail(member.user?.displayAvatarURL ? member.user.displayAvatarURL() : null)
      .addFields(fields)
      .setFooter({ text: "⚡ Alert powered by Darklin3 Bot" })
      .setTimestamp();

    // Dispatch to Discord Channel
    if (config.channelId) {
      try {
        const channel = (await this.client.fetchChannel?.(config.channelId)) as any;
        if (channel && typeof channel.send === "function") {
          await channel.send({ embeds: [embed] });
          this.logger.info("invite-manager: dispatched join alert to discord", {
            guildId: guild.id,
            memberId: member.id,
            inviterId: inviterUser?.id,
            channelId: config.channelId,
          });
        }
      } catch (err) {
        this.logger.error("invite-manager: failed to send join alert to discord channel", {
          guildId: guild.id,
          channelId: config.channelId,
          error: String(err),
        });
      }
    }

    // Log to Guild Live Console
    void logToGuildConsole(guild.id, {
      level: isFake ? "WARN" : "INFO",
      category: "ACTION_LOGS",
      message: `Member ${memberTag} joined. Invited by ${inviterTag} (${inviteCode}, ${totalUses} uses). Account age: ${accountAgeDays}d.${isFake ? " [FLAGGED AS FAKE ACCOUNT]" : ""}`,
    });

    // Save Join History record
    try {
      const joinRecord = {
        id: `join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: member.id,
        userTag: memberTag,
        userAvatar: member.user?.displayAvatarURL?.() || undefined,
        inviterId: inviterUser?.id || undefined,
        inviterTag: inviterTag !== "Unknown" ? inviterTag : undefined,
        inviteCode: matchedInvite?.code || undefined,
        channelId: matchedInvite?.channel?.id || undefined,
        channelName: channelName,
        uses: totalUses,
        accountAgeDays,
        isFake,
        isBot: Boolean(member.user?.bot),
        timestamp: new Date().toISOString(),
      };

      const updatedRecent = [joinRecord, ...(config.recentJoins || [])].slice(0, 50);
      const confPath = path.join(this.resolveStorageTenantsDir(), tenantId, "guilds", guild.id, "invites.json");
      await fs.writeFile(confPath, JSON.stringify({ ...config, recentJoins: updatedRecent }, null, 2), "utf-8");
    } catch {
      // Best-effort history persist
    }
  }

  private async handleMemberRemove(member: GuildMember): Promise<void> {
    if (this.isDestroyed || !member?.guild) return;
    const guild = member.guild;

    const record = await this.findInvitesConfig(guild.id);
    if (!record || !record.config.enabled || !record.config.channelId || !record.config.leaveMessage) {
      return;
    }
    const { config } = record;

    const memberMention = `<@${member.id}>`;
    const memberTag = member.user?.tag || member.user?.username || "UnknownUser";

    // Check if we have inviter from recent joins
    const pastJoin = config.recentJoins?.find((j) => j.userId === member.id);
    const inviterMention = pastJoin?.inviterId ? `<@${pastJoin.inviterId}>` : (pastJoin?.inviterTag || "Unknown");

    const embed = new EmbedBuilder()
      .setColor(0xf97316) // Orange
      .setTitle("📤 Member Left Server")
      .setThumbnail(member.user?.displayAvatarURL ? member.user.displayAvatarURL() : null)
      .addFields(
        {
          name: "👤 Member Details",
          value: `• ${memberMention}\n• Username: \`${memberTag}\`\n• User ID: \`${member.id}\``,
          inline: false,
        },
        {
          name: "👥 Originally Invited By",
          value: `• ${inviterMention}${pastJoin?.inviteCode ? ` (via \`${pastJoin.inviteCode}\`)` : ""}`,
          inline: false,
        },
      )
      .setFooter({ text: "⚡ Alert powered by Darklin3 Bot" })
      .setTimestamp();

    if (config.channelId) {
      try {
        const channel = (await this.client.fetchChannel?.(config.channelId)) as any;
        if (channel && typeof channel.send === "function") {
          await channel.send({ embeds: [embed] });
        }
      } catch {
        // Best-effort
      }
    }

    void logToGuildConsole(guild.id, {
      level: "INFO",
      category: "ACTION_LOGS",
      message: `Member ${memberTag} left the server. (Originally invited by ${pastJoin?.inviterTag || "Unknown"}).`,
    });
  }
}
