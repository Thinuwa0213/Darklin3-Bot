import fs from "node:fs/promises";
import path from "node:path";
import { EmbedBuilder, type GuildMember } from "discord.js";
import type { Logger } from "@creatorcore/logger";
import type { IDiscordClient } from "./discord-client.js";

export interface StoredBoosterConfig {
  enabled: boolean;
  channelId?: string;
  useEmbed: boolean;
  pingUser: boolean;
  title: string;
  message: string;
  accentColor: string;
  bannerUrl?: string;
  thankYouDm: boolean;
  thankYouDmMessage?: string;
  customBranding?: boolean;
  customFooterText?: string;
  customFooterIconUrl?: string;
  branding?: {
    customBrandingEnabled?: boolean;
    defaultFooterText?: string;
    defaultFooterIconUrl?: string;
  };
}

export class BoosterManager {
  private isDestroyed = false;
  private memberUpdateListener?: ((...args: unknown[]) => void) | undefined;

  constructor(
    public readonly client: IDiscordClient,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    this.isDestroyed = false;

    this.memberUpdateListener = (oldMemberRaw: unknown, newMemberRaw: unknown) => {
      void this.handleMemberUpdate(oldMemberRaw as GuildMember, newMemberRaw as GuildMember);
    };

    this.client.on("guildMemberUpdate", this.memberUpdateListener);
    this.logger.info("booster-manager: started and listening for server boost events");
  }

  public stop(): void {
    this.isDestroyed = true;
    if (this.memberUpdateListener) {
      this.client.removeListener("guildMemberUpdate", this.memberUpdateListener);
      this.memberUpdateListener = undefined;
    }
  }

  private async handleMemberUpdate(
    oldMember: GuildMember | null | undefined,
    newMember: GuildMember | null | undefined,
  ): Promise<void> {
    if (this.isDestroyed || !newMember || !newMember.guild) return;

    // Detect new server boost: user was not boosting before, but is boosting now
    const wasBoosting = Boolean(oldMember?.premiumSince);
    const isBoosting = Boolean(newMember.premiumSince);

    if (wasBoosting || !isBoosting) {
      return;
    }

    const guild = newMember.guild;
    const config = await this.findBoosterConfig(guild.id);
    if (!config || !config.enabled || !config.channelId) {
      return;
    }

    try {
      const channel = (await guild.channels.fetch(config.channelId).catch(() => null)) as any;
      if (!channel || typeof channel.send !== "function") {
        this.logger.warn?.("booster-manager: target announcement channel not found or not writable", {
          guildId: guild.id,
          channelId: config.channelId,
        });
        return;
      }

      const boostCount = guild.premiumSubscriptionCount ?? 1;
      const formattedTitle = this.replaceVariables(config.title, newMember, boostCount);
      const formattedMessage = this.replaceVariables(config.message, newMember, boostCount);

      if (config.useEmbed) {
        let hexInt = 0xf43f5e;
        if (config.accentColor) {
          const parsed = Number.parseInt(config.accentColor.replace("#", ""), 16);
          if (!Number.isNaN(parsed)) hexInt = parsed;
        }

        const embed = new EmbedBuilder()
          .setTitle(formattedTitle)
          .setDescription(formattedMessage)
          .setColor(hexInt)
          .setTimestamp();

        const avatarUrl = newMember.user?.displayAvatarURL?.();
        if (avatarUrl) {
          embed.setThumbnail(avatarUrl);
        }

        const guildIcon = guild.iconURL?.();
        const isWhiteLabel = Boolean(config.customBranding || config.branding?.customBrandingEnabled);
        if (isWhiteLabel) {
          const footerText =
            config.customFooterText?.trim() ||
            (config.branding?.defaultFooterText
              ? config.branding.defaultFooterText
              : `${guild.name} • Server Booster Event`);
          const footerIcon =
            config.customFooterIconUrl?.trim() ||
            (config.branding?.defaultFooterIconUrl
              ? config.branding.defaultFooterIconUrl
              : guildIcon);
          embed.setFooter({
            text: footerText,
            ...(footerIcon ? { iconURL: footerIcon } : {}),
          });
        } else {
          // Free Tier Watermark / White-label OFF
          embed.setFooter({
            text: "⚡ Alert powered by Darklin3 Bot",
          });
        }

        if (config.bannerUrl && config.bannerUrl.startsWith("http")) {
          embed.setImage(config.bannerUrl);
        }

        const sendOptions: any = { embeds: [embed] };
        if (config.pingUser) {
          sendOptions.content = `<@${newMember.user.id}>`;
        }
        await channel.send(sendOptions);
      } else {
        await channel.send({
          content: `${config.pingUser ? `<@${newMember.user.id}> ` : ""}${formattedMessage}`,
        });
      }

      this.logger.info("booster-manager: server boost announcement dispatched", {
        guildId: guild.id,
        userId: newMember.user.id,
        boostCount,
      });

      // Send Thank-You DM if enabled
      if (config.thankYouDm && config.thankYouDmMessage && typeof newMember.send === "function") {
        const dmText = this.replaceVariables(config.thankYouDmMessage, newMember, boostCount);
        await newMember.send({ content: dmText }).catch(() => {
          // DMs may be blocked by user privacy settings
        });
      }
    } catch (err) {
      this.logger.error("booster-manager: failed to dispatch boost announcement", {
        guildId: guild.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private replaceVariables(text: string, member: GuildMember, boostCount: number): string {
    return text
      .replaceAll("{user}", `<@${member.user.id}>`)
      .replaceAll("{username}", member.user.username)
      .replaceAll("{server}", member.guild.name)
      .replaceAll("{boost_count}", String(boostCount))
      .replaceAll("{count}", String(boostCount));
  }

  private async findBoosterConfig(guildId: string): Promise<StoredBoosterConfig | null> {
    try {
      const candidates: string[] = [
        path.resolve(process.cwd(), "storage", "tenants"),
        path.resolve(process.cwd(), "..", "..", "storage", "tenants"),
      ];
      let storageTenantsDir = candidates[0] ?? "";
      for (const dir of candidates) {
        try {
          await fs.access(dir);
          storageTenantsDir = dir;
          break;
        } catch {
          // Next candidate
        }
      }

      if (!storageTenantsDir) return null;

      const tenants = await fs.readdir(storageTenantsDir, { withFileTypes: true });
      for (const tenant of tenants) {
        if (!tenant.isDirectory()) continue;
        const boosterFile = path.join(storageTenantsDir, tenant.name, "guilds", guildId, "booster.json");
        const settingsFile = path.join(storageTenantsDir, tenant.name, "guilds", guildId, "settings.json");
        try {
          const content = await fs.readFile(boosterFile, "utf-8");
          const parsed = JSON.parse(content) as StoredBoosterConfig;
          try {
            const settingsContent = await fs.readFile(settingsFile, "utf-8");
            const settingsParsed = JSON.parse(settingsContent);
            if (settingsParsed?.branding) {
              parsed.branding = settingsParsed.branding;
            }
          } catch {
            // Ignore missing settings.json
          }
          return parsed;
        } catch {
          // Next tenant
        }
      }
    } catch (err) {
      this.logger.debug?.("booster-manager: error searching storage", { guildId, err });
    }
    return null;
  }
}
