import fs from "node:fs/promises";
import path from "node:path";
import { EmbedBuilder, PermissionFlagsBits, type Message } from "discord.js";
import type { Logger } from "@creatorcore/logger";
import type { IDiscordClient } from "./discord-client.js";

export interface StoredAutoModRule {
  enabled: boolean;
  action: "DELETE" | "TIMEOUT" | "WARN";
  timeoutSeconds: number;
  sendAlert?: boolean | undefined;
  sendDm?: boolean | undefined;
}

export interface StoredModerationConfig {
  enabled: boolean;
  logChannelId?: string;
  antiSpam?: StoredAutoModRule & {
    threshold?: number;
    timeSpan?: number;
  };
  imageSpam?: StoredAutoModRule & {
    maxImages?: number;
    timeSpan?: number;
  };
  antiInvites?: StoredAutoModRule & {
    allowedInvites?: string[];
  };
  badWords?: StoredAutoModRule & {
    words?: string[];
  };
  massMentions?: StoredAutoModRule & {
    maxMentions?: number;
  };
  capsLimit?: {
    enabled?: boolean;
    maxPercentage?: number;
    minLength?: number;
    action?: "DELETE" | "TIMEOUT" | "WARN";
    timeoutSeconds?: number;
    sendAlert?: boolean;
    sendDm?: boolean;
  };
  customRules?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    patterns: string[];
    action: "DELETE" | "TIMEOUT" | "WARN";
    timeoutSeconds: number;
    sendAlert?: boolean;
    sendDm?: boolean;
  }>;
  ignoredChannels?: string[];
  ignoredRoles?: string[];
}

export class AutoModManager {
  private isDestroyed = false;
  private messageListener?: ((message: unknown) => void) | undefined;
  // Key: guildId:userId -> array of timestamps
  private spamLogs = new Map<string, number[]>();
  private imageLogs = new Map<string, number[]>();

  constructor(
    public readonly client: IDiscordClient,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    this.isDestroyed = false;

    this.messageListener = (message: unknown) => {
      void this.handleMessage(message as Message);
    };

    this.client.on("messageCreate", this.messageListener);
    this.logger.info("auto-mod-manager: started and listening for chat safety violations");
  }

  public stop(): void {
    this.isDestroyed = true;
    if (this.messageListener) {
      this.client.removeListener("messageCreate", this.messageListener);
      this.messageListener = undefined;
    }
    this.spamLogs.clear();
    this.imageLogs.clear();
  }

  private async handleMessage(message: Message | null | undefined): Promise<void> {
    if (this.isDestroyed || !message || !message.guild || message.author?.bot) return;

    // Staff bypass: users with ManageMessages or Administrator permissions
    if (
      message.member?.permissions?.has(PermissionFlagsBits.ManageMessages) ||
      message.member?.permissions?.has(PermissionFlagsBits.Administrator)
    ) {
      return;
    }

    const guild = message.guild;
    const config = await this.findModerationConfig(guild.id);
    if (!config || !config.enabled) return;

    // Ignored Channels bypass
    if (config.ignoredChannels?.includes(message.channel.id)) return;

    // Ignored Roles bypass
    if (
      config.ignoredRoles &&
      config.ignoredRoles.length > 0 &&
      message.member?.roles?.cache?.some((r) => config.ignoredRoles?.includes(r.id))
    ) {
      return;
    }

    const content = message.content || "";
    const lowerContent = content.toLowerCase();

    // 1. Anti-Invite Links Check
    if (config.antiInvites?.enabled) {
      const inviteRegex = /(discord\.(gg|io|me|li|com\/invite)|discordapp\.com\/invite|discord\.com\/invite)\/[^\s/]+/i;
      if (inviteRegex.test(content)) {
        const allowed = config.antiInvites.allowedInvites || [];
        const isAllowed = allowed.some((domain) => domain.trim() && lowerContent.includes(domain.toLowerCase().trim()));
        if (!isAllowed) {
          await this.enforceViolation(message, "Unauthorized Discord Invite Link", config.antiInvites, config.logChannelId);
          return;
        }
      }
    }

    // 2. Bad Words / Banned Words Filter
    if (config.badWords?.enabled && Array.isArray(config.badWords.words) && config.badWords.words.length > 0) {
      const matchedWord = config.badWords.words.find((w) => {
        const trimmed = w.trim().toLowerCase();
        if (!trimmed) return false;
        // Word boundary match or exact match
        const regex = new RegExp(`\\b${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        return regex.test(lowerContent);
      });

      if (matchedWord) {
        await this.enforceViolation(message, `Banned Word Detected ("${matchedWord}")`, config.badWords, config.logChannelId);
        return;
      }
    }

    // 3. Custom Defined Rules Check
    if (Array.isArray(config.customRules)) {
      for (const customRule of config.customRules) {
        if (!customRule.enabled || !Array.isArray(customRule.patterns)) continue;
        const matched = customRule.patterns.find((p) => {
          const trimmed = p.trim().toLowerCase();
          if (!trimmed) return false;
          return lowerContent.includes(trimmed);
        });

        if (matched) {
          await this.enforceViolation(
            message,
            `Custom Rule Triggered: ${customRule.name} ("${matched}")`,
            customRule,
            config.logChannelId,
          );
          return;
        }
      }
    }

    // 4. Mass Mentions Protection
    if (config.massMentions?.enabled) {
      const maxMentions = config.massMentions.maxMentions ?? 4;
      const mentionCount = (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0);
      if (mentionCount >= maxMentions) {
        await this.enforceViolation(
          message,
          `Mass Mentions (${mentionCount} mentions)`,
          config.massMentions,
          config.logChannelId,
        );
        return;
      }
    }

    // 5. Image / Attachment Spam Check
    if (config.imageSpam?.enabled && message.attachments && message.attachments.size > 0) {
      const maxImages = config.imageSpam.maxImages ?? 3;
      const timeSpanMs = (config.imageSpam.timeSpan ?? 5) * 1000;
      const key = `${guild.id}:${message.author.id}`;
      const now = Date.now();

      const timestamps = (this.imageLogs.get(key) || []).filter((ts) => now - ts < timeSpanMs);
      for (let i = 0; i < message.attachments.size; i++) {
        timestamps.push(now);
      }
      this.imageLogs.set(key, timestamps);

      if (timestamps.length >= maxImages) {
        this.imageLogs.delete(key);
        await this.enforceViolation(
          message,
          `Image Flood / Attachment Spam (${timestamps.length} images / ${config.imageSpam.timeSpan ?? 5}s)`,
          config.imageSpam,
          config.logChannelId,
        );
        return;
      }
    }

    // 6. Anti-Spam (Rate Limit) Check
    if (config.antiSpam?.enabled) {
      const threshold = config.antiSpam.threshold ?? 5;
      const timeSpanMs = (config.antiSpam.timeSpan ?? 5) * 1000;
      const key = `${guild.id}:${message.author.id}`;
      const now = Date.now();

      const userTimestamps = (this.spamLogs.get(key) || []).filter((ts) => now - ts < timeSpanMs);
      userTimestamps.push(now);
      this.spamLogs.set(key, userTimestamps);

      if (userTimestamps.length >= threshold) {
        // Reset user window so we don't trigger consecutively on every message
        this.spamLogs.delete(key);
        await this.enforceViolation(
          message,
          `Chat Flood / Rapid Spam (${userTimestamps.length} msgs / ${config.antiSpam.timeSpan ?? 5}s)`,
          config.antiSpam,
          config.logChannelId,
        );
        return;
      }
    }

    // 7. Caps Limit
    if (config.capsLimit?.enabled && content.length >= (config.capsLimit.minLength ?? 10)) {
      const letters = content.replace(/[^a-zA-Z]/g, "");
      if (letters.length >= (config.capsLimit.minLength ?? 10)) {
        const upperCount = content.replace(/[^A-Z]/g, "").length;
        const percentage = (upperCount / letters.length) * 100;
        if (percentage >= (config.capsLimit.maxPercentage ?? 70)) {
          await this.enforceViolation(
            message,
            `Excessive Capital Letters (${Math.round(percentage)}% Caps)`,
            {
              enabled: true,
              action: config.capsLimit.action ?? "DELETE",
              timeoutSeconds: config.capsLimit.timeoutSeconds ?? 60,
              sendAlert: config.capsLimit.sendAlert ?? false,
              sendDm: config.capsLimit.sendDm ?? false,
            },
            config.logChannelId,
          );
          return;
        }
      }
    }
  }

  private async enforceViolation(
    message: Message,
    reason: string,
    rule: StoredAutoModRule,
    logChannelId?: string,
  ): Promise<void> {
    const action = rule.action || "DELETE";
    const user = message.author;
    const channel = message.channel;
    const originalContent = message.content;

    // Delete message if action is DELETE or TIMEOUT
    if (action === "DELETE" || action === "TIMEOUT") {
      await message.delete().catch(() => {});
    }

    // Timeout member if action is TIMEOUT
    if (action === "TIMEOUT" && message.member && typeof message.member.timeout === "function") {
      const durationSeconds = rule.timeoutSeconds || 300;
      await message.member.timeout(durationSeconds * 1000, `[Darklin3 AutoMod] ${reason}`).catch(() => {});
    }

    // Send DM warning to user if enabled
    if (rule.sendDm && user && typeof (user as any).send === "function") {
      try {
        await (user as any).send(
          `🛡️ **${message.guild?.name || "Server"} Defense Alert**:\nYour message was removed: **${reason}**.\nPlease review and follow server rules.`,
        ).catch(() => {});
      } catch {
        // User may have DMs closed
      }
    }

    // Ephemeral warning / Channel feedback
    if (rule.sendAlert || action === "WARN" || action === "TIMEOUT") {
      try {
        if ("send" in channel && typeof channel.send === "function") {
          const alert = await channel.send({
            content: `🛡️ <@${user.id}>, your message was removed: **${reason}**.`,
          });
          // Auto clean alert after 5 seconds
          setTimeout(() => alert.delete().catch(() => {}), 5000);
        }
      } catch {
        // Non-fatal
      }
    }

    this.logger.info("auto-mod-manager: violation enforced", {
      guildId: message.guild?.id ?? "unknown",
      userId: user.id,
      reason,
      action,
    });

    // Log violation to logChannel if configured
    if (logChannelId && message.guild) {
      try {
        const logChannel = (await message.guild.channels.fetch(logChannelId).catch(() => null)) as any;
        if (logChannel && typeof logChannel.send === "function") {
          const embed = new EmbedBuilder()
            .setTitle("🛡️ Auto-Moderation Violation")
            .setColor(0xef4444)
            .addFields(
              { name: "Violator", value: `<@${user.id}> (${user.tag})`, inline: true },
              { name: "Channel", value: `<#${channel.id}>`, inline: true },
              { name: "Action Taken", value: `\`${action}\``, inline: true },
              { name: "Trigger Reason", value: reason },
              { name: "Message Snippet", value: originalContent ? originalContent.slice(0, 500) : "*(empty)*" },
            )
            .setTimestamp();
            const guildIcon = message.guild.iconURL?.();
            embed.setFooter({
              text: "⚡ Alert powered by Darklin3 Bot",
              ...(guildIcon ? { iconURL: guildIcon } : {}),
            });

          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch {
        // Non-fatal
      }
    }
  }

  private async findModerationConfig(guildId: string): Promise<StoredModerationConfig | null> {
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
        const modFile = path.join(storageTenantsDir, tenant.name, "guilds", guildId, "moderation.json");
        try {
          const content = await fs.readFile(modFile, "utf-8");
          return JSON.parse(content) as StoredModerationConfig;
        } catch {
          // Next tenant
        }
      }
    } catch (err) {
      this.logger.debug?.("auto-mod-manager: error searching storage", { guildId, err });
    }
    return null;
  }
}
