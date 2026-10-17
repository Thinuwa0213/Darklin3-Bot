import fs from "node:fs/promises";
import path from "node:path";
import { EmbedBuilder } from "discord.js";
import type { Logger } from "@darklin3_bot/logger";
import type { IDiscordClient } from "./discord-client.js";
import { logToGuildConsole } from "./guild-console-logger.js";

export interface StoredActionLogsConfig {
  enabled: boolean;
  defaultChannelId?: string;
  specifyPerCategory: boolean;
  individualChannels?: boolean;
  showMemberAvatars?: boolean;
  newAccountAgeDays?: number;
  eventChannels?: Record<string, string | undefined>;
  categories: {
    messages?: {
      enabled?: boolean;
      channelId?: string;
      events?: {
        messageDelete?: boolean;
        messageUpdate?: boolean;
        imageDelete?: boolean;
        bulkDelete?: boolean;
        invites?: boolean;
        modCommands?: boolean;
      };
    };
    members?: {
      enabled?: boolean;
      channelId?: string;
      events?: {
        memberJoin?: boolean;
        memberLeave?: boolean;
        roleUpdate?: boolean;
        nicknameUpdate?: boolean;
        memberRoleAdd?: boolean;
        memberRoleRemove?: boolean;
        memberTimeout?: boolean;
      };
    };
    moderation?: {
      enabled?: boolean;
      channelId?: string;
      events?: {
        memberBan?: boolean;
        memberUnban?: boolean;
        memberTimeout?: boolean;
      };
    };
    channelsAndRoles?: {
      enabled?: boolean;
      channelId?: string;
      events?: {
        channelCreate?: boolean;
        channelDelete?: boolean;
        channelUpdate?: boolean;
        roleCreate?: boolean;
        roleDelete?: boolean;
        roleUpdate?: boolean;
      };
    };
    voice?: {
      enabled?: boolean;
      channelId?: string;
      events?: {
        voiceJoin?: boolean;
        voiceLeave?: boolean;
        voiceMove?: boolean;
      };
    };
  };
  ignoredChannels?: string[];
  ignoredRoles?: string[];
}

export class ActionLogManager {
  private isDestroyed = false;
  private listeners: Array<{ event: string; fn: (...args: any[]) => void }> = [];

  constructor(
    public readonly client: IDiscordClient,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    this.isDestroyed = false;

    this.registerEvent("messageDelete", (msg: any) => this.handleMessageDelete(msg));
    this.registerEvent("messageUpdate", (oldMsg: any, newMsg: any) => this.handleMessageUpdate(oldMsg, newMsg));
    this.registerEvent("messageDeleteBulk", (messages: any) => this.handleMessageDeleteBulk(messages));
    this.registerEvent("guildMemberAdd", (member: any) => this.handleMemberAdd(member));
    this.registerEvent("guildMemberRemove", (member: any) => this.handleMemberRemove(member));
    this.registerEvent("guildMemberUpdate", (oldM: any, newM: any) => this.handleMemberUpdate(oldM, newM));
    this.registerEvent("guildBanAdd", (ban: any) => this.handleBanAdd(ban));
    this.registerEvent("guildBanRemove", (ban: any) => this.handleBanRemove(ban));
    this.registerEvent("channelCreate", (channel: any) => this.handleChannelCreate(channel));
    this.registerEvent("channelDelete", (channel: any) => this.handleChannelDelete(channel));
    this.registerEvent("channelUpdate", (oldC: any, newC: any) => this.handleChannelUpdate(oldC, newC));
    this.registerEvent("roleCreate", (role: any) => this.handleRoleCreate(role));
    this.registerEvent("roleDelete", (role: any) => this.handleRoleDelete(role));
    this.registerEvent("roleUpdate", (oldR: any, newR: any) => this.handleRoleUpdate(oldR, newR));
    this.registerEvent("voiceStateUpdate", (oldS: any, newS: any) => this.handleVoiceStateUpdate(oldS, newS));
    this.registerEvent("inviteCreate", (invite: any) => this.handleInviteCreate(invite));
    this.registerEvent("inviteDelete", (invite: any) => this.handleInviteDelete(invite));

    this.logger.info("action-log-manager: started and listening for guild events");
  }

  public stop(): void {
    this.isDestroyed = true;
    for (const { event, fn } of this.listeners) {
      this.client.removeListener(event, fn);
    }
    this.listeners = [];
  }

  private registerEvent(event: string, handler: (...args: any[]) => void): void {
    const wrapped = (...args: any[]) => {
      if (this.isDestroyed) return;
      try {
        handler(...args);
      } catch (err) {
        this.logger.debug?.(`action-log-manager: error in ${event} handler`, { err });
      }
    };
    this.listeners.push({ event, fn: wrapped });
    this.client.on(event, wrapped);
  }

  private getTargetChannel(
    config: StoredActionLogsConfig,
    eventKey: string,
    categoryKey: keyof StoredActionLogsConfig["categories"],
  ): string | undefined {
    if (config.individualChannels && config.eventChannels?.[eventKey]) {
      return config.eventChannels[eventKey];
    }
    const cat = (config.categories as any)?.[categoryKey];
    if (config.specifyPerCategory && cat?.channelId) {
      return cat.channelId;
    }
    return config.defaultChannelId;
  }

  // --- Event Handlers (Modelled after VertexRp_Bot & Darklin3 Standards) ---

  private async handleMessageDelete(message: any): Promise<void> {
    const guild = message?.guild || (message?.guildId ? (this.client as any).guilds?.cache?.get(message.guildId) : null);
    if (!guild) return;

    const config = await this.findActionLogsConfig(guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.messages;
    if (cat?.enabled === false) return;
    if (config.ignoredChannels?.includes(message.channel?.id)) return;

    // Check if partial (uncached) message
    if (message.partial) {
      const targetChannelId = this.getTargetChannel(config, "messages.messageDelete", "messages");
      if (!targetChannelId) return;

      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("🗑️ Message Deleted")
        .setDescription(`A message was deleted in ${message.channel || "Unknown Channel"}\n*(Content and author unavailable - uncached)*`)
        .setTimestamp();

      await this.dispatchLog(guild, targetChannelId, embed);
      return;
    }

    if (message.author?.bot) return;

    const hasAttachment = Boolean(message.attachments && message.attachments.size > 0);
    if (hasAttachment && cat?.events?.imageDelete === false) return;
    if (!hasAttachment && cat?.events?.messageDelete === false) return;

    const eventKey = hasAttachment ? "messages.imageDelete" : "messages.messageDelete";
    const targetChannelId = this.getTargetChannel(config, eventKey, "messages");
    if (!targetChannelId) return;

    const authorTag = message.author ? `${message.author.tag}` : "Unknown";
    const authorAvatar = message.author?.displayAvatarURL?.() ?? undefined;

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setAuthor({ name: authorTag, ...(authorAvatar ? { iconURL: authorAvatar } : {}) })
      .setDescription(`🗑️ **Message deleted in** ${message.channel || "Unknown Channel"}`)
      .setTimestamp();

    if (message.content) {
      const truncated = message.content.length > 1024 ? message.content.slice(0, 1021) + "..." : message.content;
      embed.addFields({ name: "Content", value: truncated });
    } else if (!hasAttachment) {
      embed.addFields({ name: "Content", value: "*(No text content)*" });
    }

    // Attachments Handling (VertexRp_Bot pattern)
    if (hasAttachment) {
      const firstAttachment = message.attachments.first?.();
      if (firstAttachment?.contentType?.startsWith?.("image/")) {
        embed.setImage(firstAttachment.url);
      }
      const attachmentList = message.attachments.map?.((a: any) => `[${a.name || "Attachment"}](${a.url})`).join("\n");
      if (attachmentList) {
        embed.addFields({
          name: "Attachments",
          value: attachmentList.length > 1024 ? "*Too many attachments to display*" : attachmentList,
        });
      }
    }

    await this.dispatchLog(guild, targetChannelId, embed);
  }

  private async handleMessageUpdate(oldMessage: any, newMessage: any): Promise<void> {
    if (oldMessage?.partial) {
      try {
        await oldMessage.fetch();
      } catch {
        return;
      }
    }

    if (!oldMessage?.author || oldMessage.author.bot || !oldMessage.guild) return;
    if (oldMessage.content === newMessage?.content) return; // Ignore pin/embed updates

    const guild = oldMessage.guild;
    const config = await this.findActionLogsConfig(guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.messages;
    if (cat?.enabled === false || cat?.events?.messageUpdate === false) return;
    if (config.ignoredChannels?.includes(newMessage.channel?.id)) return;

    const targetChannelId = this.getTargetChannel(config, "messages.messageUpdate", "messages");
    if (!targetChannelId) return;

    const authorAvatar = oldMessage.author.displayAvatarURL?.() ?? undefined;
    const jumpLink = newMessage.url ? ` [Jump to Message](${newMessage.url})` : "";

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setAuthor({ name: oldMessage.author.tag, ...(authorAvatar ? { iconURL: authorAvatar } : {}) })
      .setDescription(`✏️ **Message edited in** ${oldMessage.channel}${jumpLink}`)
      .addFields(
        {
          name: "Before",
          value: oldMessage.content
            ? oldMessage.content.length > 1024 ? oldMessage.content.slice(0, 1021) + "..." : oldMessage.content
            : "*No text content*",
        },
        {
          name: "After",
          value: newMessage.content
            ? newMessage.content.length > 1024 ? newMessage.content.slice(0, 1021) + "..." : newMessage.content
            : "*No text content*",
        },
      )
      .setTimestamp();

    await this.dispatchLog(guild, targetChannelId, embed);
  }

  private async handleMessageDeleteBulk(messages: any): Promise<void> {
    if (!messages || typeof messages.first !== "function") return;
    const firstMessage = messages.first();
    if (!firstMessage || !firstMessage.guild) return;

    const config = await this.findActionLogsConfig(firstMessage.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.messages;
    if (cat?.enabled === false || cat?.events?.bulkDelete === false) return;
    if (config.ignoredChannels?.includes(firstMessage.channel?.id)) return;

    const targetChannelId = this.getTargetChannel(config, "messages.bulkDelete", "messages");
    if (!targetChannelId) return;

    const count = messages.size ?? 0;
    const embed = new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle("🧹 Bulk Messages Deleted")
      .setDescription(`**${count} messages** were purged in <#${firstMessage.channel?.id}>.`)
      .setTimestamp();

    await this.dispatchLog(firstMessage.guild, targetChannelId, embed);
  }

  private async handleMemberAdd(member: any): Promise<void> {
    if (!member || !member.guild) return;
    const config = await this.findActionLogsConfig(member.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.members;
    if (cat?.enabled === false || cat?.events?.memberJoin === false) return;

    const targetChannelId = this.getTargetChannel(config, "members.memberJoin", "members");
    if (!targetChannelId) return;

    const createdDate = member.user?.createdAt ? new Date(member.user.createdAt) : null;
    const ageDays = createdDate
      ? Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const thresholdDays = config.newAccountAgeDays ?? 7;
    const isNewAccount = ageDays !== null && ageDays <= thresholdDays;

    const embed = new EmbedBuilder()
      .setTitle("👋 Member Joined")
      .setColor(isNewAccount ? 0xf59e0b : 0x10b981)
      .setDescription(`<@${member.id}> (**${member.user?.tag || member.id}**) joined the server.`)
      .addFields(
        {
          name: "Account Age",
          value: createdDate
            ? `${createdDate.toDateString()}${isNewAccount ? ` (⚠️ New Account: ${ageDays}d old)` : ""}`
            : "Unknown",
          inline: true,
        },
        { name: "Total Members", value: String(member.guild.memberCount ?? "N/A"), inline: true },
      )
      .setTimestamp();

    if (config.showMemberAvatars !== false && member.user?.displayAvatarURL) {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    await this.dispatchLog(member.guild, targetChannelId, embed);
  }

  private async handleMemberRemove(member: any): Promise<void> {
    if (!member || !member.guild) return;
    const config = await this.findActionLogsConfig(member.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.members;
    if (cat?.enabled === false || cat?.events?.memberLeave === false) return;

    const targetChannelId = this.getTargetChannel(config, "members.memberLeave", "members");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🚪 Member Left")
      .setColor(0xf97316)
      .setDescription(`<@${member.id}> (**${member.user?.tag || member.id}**) left the server.`)
      .addFields({ name: "Total Members", value: String(member.guild.memberCount ?? "N/A"), inline: true })
      .setTimestamp();

    if (config.showMemberAvatars !== false && member.user?.displayAvatarURL) {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    await this.dispatchLog(member.guild, targetChannelId, embed);
  }

  private async handleMemberUpdate(oldMember: any, newMember: any): Promise<void> {
    if (!newMember || !newMember.guild) return;
    const config = await this.findActionLogsConfig(newMember.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.members;
    if (cat?.enabled === false) return;

    const avatar = newMember.user?.displayAvatarURL?.() ?? undefined;

    // 1. Role Additions / Removals (VertexRp_Bot pattern)
    if (oldMember.roles?.cache && newMember.roles?.cache) {
      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;

      const addedRoles = newRoles.filter((r: any) => !oldRoles.has(r.id));
      if (addedRoles.size > 0 && cat?.events?.roleUpdate !== false) {
        const targetChannelId = this.getTargetChannel(config, "members.roleUpdate", "members");
        if (targetChannelId) {
          const embed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setAuthor({ name: "Member Roles Added", ...(avatar ? { iconURL: avatar } : {}) })
            .setDescription(`${newMember.user} (**${newMember.user.tag}**) roles updated.`)
            .addFields({ name: "Added Roles", value: addedRoles.map((r: any) => `<@&${r.id}>`).join(", ") })
            .setTimestamp();
          await this.dispatchLog(newMember.guild, targetChannelId, embed);
        }
      }

      const removedRoles = oldRoles.filter((r: any) => !newRoles.has(r.id));
      if (removedRoles.size > 0 && cat?.events?.roleUpdate !== false) {
        const targetChannelId = this.getTargetChannel(config, "members.roleUpdate", "members");
        if (targetChannelId) {
          const embed = new EmbedBuilder()
            .setColor(0xef4444)
            .setAuthor({ name: "Member Roles Removed", ...(avatar ? { iconURL: avatar } : {}) })
            .setDescription(`${newMember.user} (**${newMember.user.tag}**) roles updated.`)
            .addFields({ name: "Removed Roles", value: removedRoles.map((r: any) => `<@&${r.id}>`).join(", ") })
            .setTimestamp();
          await this.dispatchLog(newMember.guild, targetChannelId, embed);
        }
      }
    }

    // 2. Nickname Change (VertexRp_Bot pattern)
    if (oldMember.nickname !== newMember.nickname && cat?.events?.nicknameUpdate !== false) {
      const targetChannelId = this.getTargetChannel(config, "members.nicknameUpdate", "members");
      if (targetChannelId) {
        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setAuthor({ name: "Nickname Changed", ...(avatar ? { iconURL: avatar } : {}) })
          .setDescription(`${newMember.user} (**${newMember.user.tag}**) updated their nickname.`)
          .addFields(
            { name: "Before", value: oldMember.nickname || "None", inline: true },
            { name: "After", value: newMember.nickname || "None", inline: true },
          )
          .setTimestamp();
        await this.dispatchLog(newMember.guild, targetChannelId, embed);
      }
    }

    // 3. Member Timeout Changes (VertexRp_Bot pattern)
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (oldTimeout !== newTimeout) {
      const targetChannelId = this.getTargetChannel(config, "moderation.memberTimeout", "moderation");
      if (targetChannelId) {
        if (newTimeout && newTimeout > Date.now()) {
          const embed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setAuthor({ name: "Member Timed Out", ...(avatar ? { iconURL: avatar } : {}) })
            .setDescription(`${newMember.user} (**${newMember.user.tag}**) was timed out.`)
            .addFields({ name: "Expires", value: `<t:${Math.floor(newTimeout / 1000)}:R>`, inline: true })
            .setTimestamp();
          await this.dispatchLog(newMember.guild, targetChannelId, embed);
        } else if (oldTimeout && (!newTimeout || newTimeout <= Date.now())) {
          const embed = new EmbedBuilder()
            .setColor(0x10b981)
            .setAuthor({ name: "Timeout Removed", ...(avatar ? { iconURL: avatar } : {}) })
            .setDescription(`${newMember.user} (**${newMember.user.tag}**) timeout has been lifted.`)
            .setTimestamp();
          await this.dispatchLog(newMember.guild, targetChannelId, embed);
        }
      }
    }
  }

  private async handleBanAdd(ban: any): Promise<void> {
    if (!ban || !ban.guild) return;
    const config = await this.findActionLogsConfig(ban.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.moderation;
    if (cat?.enabled === false || cat?.events?.memberBan === false) return;

    const targetChannelId = this.getTargetChannel(config, "moderation.memberBan", "moderation");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🔨 Member Banned")
      .setColor(0xdc2626)
      .setDescription(`<@${ban.user?.id}> (**${ban.user?.tag || ban.user?.id}**) was banned from the server.`)
      .addFields({ name: "Reason", value: ban.reason || "No reason provided" })
      .setTimestamp();

    await this.dispatchLog(ban.guild, targetChannelId, embed);
  }

  private async handleBanRemove(ban: any): Promise<void> {
    if (!ban || !ban.guild) return;
    const config = await this.findActionLogsConfig(ban.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.moderation;
    if (cat?.enabled === false || cat?.events?.memberUnban === false) return;

    const targetChannelId = this.getTargetChannel(config, "moderation.memberUnban", "moderation");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🔓 Member Unbanned")
      .setColor(0x059669)
      .setDescription(`<@${ban.user?.id}> (**${ban.user?.tag || ban.user?.id}**) was unbanned.`)
      .setTimestamp();

    await this.dispatchLog(ban.guild, targetChannelId, embed);
  }

  private async handleChannelCreate(channel: any): Promise<void> {
    if (!channel || !channel.guild) return;
    const config = await this.findActionLogsConfig(channel.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.channelsAndRoles;
    if (cat?.enabled === false || cat?.events?.channelCreate === false) return;

    const targetChannelId = this.getTargetChannel(config, "channels.channelCreate", "channelsAndRoles");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("📁 Channel Created")
      .setColor(0x10b981)
      .setDescription(`Channel <#${channel.id}> (**#${channel.name}**) was created.`)
      .setTimestamp();

    await this.dispatchLog(channel.guild, targetChannelId, embed);
  }

  private async handleChannelDelete(channel: any): Promise<void> {
    if (!channel || !channel.guild) return;
    const config = await this.findActionLogsConfig(channel.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.channelsAndRoles;
    if (cat?.enabled === false || cat?.events?.channelDelete === false) return;

    const targetChannelId = this.getTargetChannel(config, "channels.channelDelete", "channelsAndRoles");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Channel Deleted")
      .setColor(0xef4444)
      .setDescription(`Channel **#${channel.name}** was deleted.`)
      .setTimestamp();

    await this.dispatchLog(channel.guild, targetChannelId, embed);
  }

  private async handleChannelUpdate(oldChannel: any, newChannel: any): Promise<void> {
    if (!newChannel || !newChannel.guild) return;
    if (oldChannel?.name === newChannel?.name && oldChannel?.topic === newChannel?.topic) return;

    const config = await this.findActionLogsConfig(newChannel.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.channelsAndRoles;
    if (cat?.enabled === false || (cat?.events as any)?.channelUpdate === false) return;

    const targetChannelId = this.getTargetChannel(config, "channels.channelUpdate", "channelsAndRoles");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("📁 Channel Updated")
      .setColor(0xf59e0b)
      .setDescription(`Channel <#${newChannel.id}> was modified.`)
      .setTimestamp();

    if (oldChannel.name !== newChannel.name) {
      embed.addFields(
        { name: "Old Name", value: `#${oldChannel.name}`, inline: true },
        { name: "New Name", value: `#${newChannel.name}`, inline: true },
      );
    }

    await this.dispatchLog(newChannel.guild, targetChannelId, embed);
  }

  private async handleRoleCreate(role: any): Promise<void> {
    if (!role || !role.guild) return;
    const config = await this.findActionLogsConfig(role.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.channelsAndRoles;
    if (cat?.enabled === false || cat?.events?.roleCreate === false) return;

    const targetChannelId = this.getTargetChannel(config, "roles.roleCreate", "channelsAndRoles");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🛡️ Role Created")
      .setColor(0x10b981)
      .setDescription(`Role **@${role.name}** was created.`)
      .setTimestamp();

    await this.dispatchLog(role.guild, targetChannelId, embed);
  }

  private async handleRoleDelete(role: any): Promise<void> {
    if (!role || !role.guild) return;
    const config = await this.findActionLogsConfig(role.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.channelsAndRoles;
    if (cat?.enabled === false || cat?.events?.roleDelete === false) return;

    const targetChannelId = this.getTargetChannel(config, "roles.roleDelete", "channelsAndRoles");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Role Deleted")
      .setColor(0xef4444)
      .setDescription(`Role **@${role.name}** was deleted.`)
      .setTimestamp();

    await this.dispatchLog(role.guild, targetChannelId, embed);
  }

  private async handleRoleUpdate(oldRole: any, newRole: any): Promise<void> {
    if (!newRole || !newRole.guild) return;
    if (oldRole?.name === newRole?.name && oldRole?.color === newRole?.color) return;

    const config = await this.findActionLogsConfig(newRole.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.channelsAndRoles;
    if (cat?.enabled === false || (cat?.events as any)?.roleUpdate === false) return;

    const targetChannelId = this.getTargetChannel(config, "roles.roleUpdate", "channelsAndRoles");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setTitle("🛡️ Role Updated")
      .setColor(0x3b82f6)
      .setDescription(`Role **@${newRole.name}** was modified.`)
      .addFields(
        { name: "Before", value: oldRole.name, inline: true },
        { name: "After", value: newRole.name, inline: true },
      )
      .setTimestamp();

    await this.dispatchLog(newRole.guild, targetChannelId, embed);
  }

  private async handleVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
    const member = newState?.member || oldState?.member;
    if (!member || member.user?.bot) return;

    const guild = newState?.guild || oldState?.guild;
    if (!guild) return;

    const config = await this.findActionLogsConfig(guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.voice;
    if (cat?.enabled === false) return;

    let eventKey = "";
    let description = "";
    let color = 0x3b82f6;

    // Join
    if (!oldState.channelId && newState.channelId) {
      if (cat?.events?.voiceJoin === false) return;
      eventKey = "voice.voiceJoin";
      description = `🔊 ${member.user} **joined voice channel** <#${newState.channelId}>`;
      color = 0x10b981;
    }
    // Leave
    else if (oldState.channelId && !newState.channelId) {
      if (cat?.events?.voiceJoin === false) return;
      eventKey = "voice.voiceJoin";
      description = `🔇 ${member.user} **left voice channel** <#${oldState.channelId}>`;
      color = 0xef4444;
    }
    // Move
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (cat?.events?.voiceMove === false) return;
      eventKey = "voice.voiceMove";
      description = `🔀 ${member.user} **moved from** <#${oldState.channelId}> **to** <#${newState.channelId}>`;
      color = 0xf59e0b;
    }

    if (!eventKey) return;

    const targetChannelId = this.getTargetChannel(config, eventKey, "voice");
    if (!targetChannelId) return;

    const avatar = member.user?.displayAvatarURL?.() ?? undefined;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: member.user.tag, ...(avatar ? { iconURL: avatar } : {}) })
      .setDescription(description)
      .setTimestamp();

    await this.dispatchLog(guild, targetChannelId, embed);
  }

  private async handleInviteCreate(invite: any): Promise<void> {
    if (!invite || !invite.guild) return;
    const config = await this.findActionLogsConfig(invite.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.messages;
    if (cat?.enabled === false || cat?.events?.invites === false) return;

    const targetChannelId = this.getTargetChannel(config, "messages.invites", "messages");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("🔗 Invite Created")
      .setDescription(`A new invite was created by <@${invite.inviter?.id}>`)
      .addFields(
        { name: "Code", value: `\`${invite.code}\``, inline: true },
        { name: "Channel", value: `<#${invite.channel?.id}>`, inline: true },
        {
          name: "Expires",
          value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : "Never",
          inline: true,
        },
      )
      .setTimestamp();

    await this.dispatchLog(invite.guild, targetChannelId, embed);
  }

  private async handleInviteDelete(invite: any): Promise<void> {
    if (!invite || !invite.guild) return;
    const config = await this.findActionLogsConfig(invite.guild.id);
    if (!config || !config.enabled) return;

    const cat = config.categories?.messages;
    if (cat?.enabled === false || cat?.events?.invites === false) return;

    const targetChannelId = this.getTargetChannel(config, "messages.invites", "messages");
    if (!targetChannelId) return;

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("🔗 Invite Deleted")
      .setDescription(`Invite code \`${invite.code}\` was deleted or expired.`)
      .setTimestamp();

    await this.dispatchLog(invite.guild, targetChannelId, embed);
  }

  private async dispatchLog(guild: any, channelId: string, embed: EmbedBuilder): Promise<void> {
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && typeof channel.send === "function") {
        const guildIcon = guild.iconURL?.();
        embed.setFooter({
          text: "⚡ Alert powered by Darklin3 Bot",
          ...(guildIcon ? { iconURL: guildIcon } : {}),
        });
        await channel.send({ embeds: [embed] }).catch((err: any) => {
          void logToGuildConsole(guild.id, {
            level: "ERROR",
            category: "ACTION_LOGS",
            message: `Discord rejected embed in channel #${channel.name || channelId}: ${err?.message || "Missing Permissions (403)"}`,
          });
        });

        const title = (embed.data as any)?.title || "Action event";
        void logToGuildConsole(guild.id, {
          level: "INFO",
          category: "ACTION_LOGS",
          message: `Action log "${title}" sent to #${channel.name || channelId}`,
        });
      } else {
        void logToGuildConsole(guild.id, {
          level: "WARN",
          category: "ACTION_LOGS",
          message: `Action log channel <#${channelId}> unreachable or bot missing 'View Channel' permission.`,
        });
      }
    } catch (err: any) {
      void logToGuildConsole(guild.id, {
        level: "ERROR",
        category: "ACTION_LOGS",
        message: `Action log error: ${err?.message || String(err)}`,
      });
    }
  }

  private async findActionLogsConfig(guildId: string): Promise<StoredActionLogsConfig | null> {
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
        const logFile = path.join(storageTenantsDir, tenant.name, "guilds", guildId, "action-logs.json");
        try {
          const content = await fs.readFile(logFile, "utf-8");
          return JSON.parse(content) as StoredActionLogsConfig;
        } catch {
          // Next tenant
        }
      }
    } catch (err) {
      this.logger.debug?.("action-log-manager: error searching storage", { guildId, err });
    }
    return null;
  }
}
