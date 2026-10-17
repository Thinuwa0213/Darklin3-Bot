import fs from "node:fs/promises";
import path from "node:path";
import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  GuildMember,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageReaction,
  User,
  type PartialMessageReaction,
  type PartialUser,
} from "discord.js";
import type { Logger } from "@darklin3_bot/logger";
import type { IDiscordClient } from "./discord-client.js";

export interface StoredRoleOption {
  id: string;
  roleId: string;
  roleName: string;
  label: string;
  description?: string;
  emoji?: string;
  style: "primary" | "secondary" | "success" | "danger";
}

export interface StoredRolePanel {
  id: string;
  name: string;
  description?: string;
  channelId: string;
  type: "BUTTON" | "DROPDOWN" | "REACTION";
  mode: "MULTI" | "EXCLUSIVE";
  maxSelections?: number;
  requiredRoleId?: string;
  forbiddenRoleId?: string;
  options: StoredRoleOption[];
  messageId?: string;
}

export interface StoredRolePanelsConfig {
  enabled?: boolean;
  panels: StoredRolePanel[];
  loggingEnabled: boolean;
  logChannelId?: string;
}

export class RolePanelManager {
  private isDestroyed = false;

  constructor(
    public readonly client: IDiscordClient,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    this.isDestroyed = false;
    this.logger.info("role-panel-manager: started and ready to handle component interactions");
  }

  public stop(): void {
    this.isDestroyed = true;
  }

  /**
   * Dispatches Button or Select Menu interactions with customId prefix `role_panel:`
   */
  public async handleInteraction(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
  ): Promise<void> {
    if (this.isDestroyed) return;
    if (!interaction.guildId || !interaction.guild) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "This action can only be used in a server.", ephemeral: true });
      }
      return;
    }

    // Always defer reply immediately to prevent Discord 3-second timeout
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const guild = interaction.guild;
    const config = await this.findRolePanelsConfig(guild.id);
    if (!config || !config.panels || config.panels.length === 0) {
      await interaction.editReply({ content: "⚠️ No role panels are currently configured for this server." });
      return;
    }

    if (config.enabled === false) {
      await interaction.editReply({ content: "⏸️ The role selection module is currently paused by an administrator." });
      return;
    }

    const member =
      interaction.member instanceof GuildMember
        ? interaction.member
        : await guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
      await interaction.editReply({ content: "⚠️ Could not verify your server membership." });
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply({
        content: "⚠️ The bot lacks the **Manage Roles** permission. Please notify an administrator.",
      });
      return;
    }

    if (interaction.isButton()) {
      await this.handleButtonClick(interaction, member, me, config);
    } else if (interaction.isStringSelectMenu()) {
      await this.handleSelectMenu(interaction, member, me, config);
    }
  }

  public async handleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (this.isDestroyed || user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch().catch(() => null);
      if (user.partial) await user.fetch().catch(() => null);

      const message = reaction.message;
      const guild = message.guild;
      if (!guild) return;

      const config = await this.findRolePanelsConfig(guild.id);
      if (!config || !config.panels || config.enabled === false) return;

      const panel = config.panels.find((p) => p.messageId === message.id && p.type === "REACTION");
      if (!panel) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return;

      const option = panel.options.find((o) => this.matchesReactionEmoji(reaction.emoji, o.emoji));
      if (!option) return;

      const gateError = this.checkRoleGates(member, panel);
      if (gateError) {
        await reaction.users.remove(user.id).catch(() => {});
        await member.send(`⚠️ ${gateError}`).catch(() => {});
        return;
      }

      const role = guild.roles.cache.get(option.roleId) ?? (await guild.roles.fetch(option.roleId).catch(() => null));
      if (!role || me.roles.highest.position <= role.position) return;

      // EXCLUSIVE mode: Remove other roles from the same panel
      if (panel.mode === "EXCLUSIVE") {
        for (const other of panel.options) {
          if (other.id !== option.id && member.roles.cache.has(other.roleId)) {
            await member.roles.remove(other.roleId).catch(() => {});
            await this.logEvent(guild.id, {
              config,
              guild,
              userId: member.id,
              userName: member.user.tag,
              panelId: panel.id,
              panelName: panel.name,
              roleId: other.roleId,
              roleName: other.roleName,
              action: "REMOVE",
            });
          }
        }
      }

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role.id);
        await this.logEvent(guild.id, {
          config,
          guild,
          userId: member.id,
          userName: member.user.tag,
          panelId: panel.id,
          panelName: panel.name,
          roleId: role.id,
          roleName: role.name,
          action: "ADD",
        });
      }
    } catch (err) {
      this.logger.debug?.("role-panel-manager: handleReactionAdd error", { err });
    }
  }

  public async handleReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (this.isDestroyed || user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch().catch(() => null);
      if (user.partial) await user.fetch().catch(() => null);

      const message = reaction.message;
      const guild = message.guild;
      if (!guild) return;

      const config = await this.findRolePanelsConfig(guild.id);
      if (!config || !config.panels || config.enabled === false) return;

      const panel = config.panels.find((p) => p.messageId === message.id && p.type === "REACTION");
      if (!panel) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const option = panel.options.find((o) => this.matchesReactionEmoji(reaction.emoji, o.emoji));
      if (!option) return;

      const role = guild.roles.cache.get(option.roleId) ?? (await guild.roles.fetch(option.roleId).catch(() => null));
      if (!role) return;

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id);
        await this.logEvent(guild.id, {
          config,
          guild,
          userId: member.id,
          userName: member.user.tag,
          panelId: panel.id,
          panelName: panel.name,
          roleId: role.id,
          roleName: role.name,
          action: "REMOVE",
        });
      }
    } catch (err) {
      this.logger.debug?.("role-panel-manager: handleReactionRemove error", { err });
    }
  }

  private matchesReactionEmoji(reactionEmoji: { name: string | null; id: string | null }, optionEmoji?: string): boolean {
    if (!optionEmoji?.trim()) return false;
    const trimmed = optionEmoji.trim();
    const customMatch = trimmed.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
    if (customMatch && customMatch[2]) {
      return reactionEmoji.id === customMatch[2];
    }
    return reactionEmoji.name === trimmed || reactionEmoji.id === trimmed;
  }

  private async handleButtonClick(
    interaction: ButtonInteraction,
    member: GuildMember,
    me: GuildMember,
    config: StoredRolePanelsConfig,
  ): Promise<void> {
    // Custom ID format: role_panel:btn:<panelId>:<optionId>
    const parts = interaction.customId.split(":");
    const panelId = parts[2];
    const optionId = parts[3];

    const panel = config.panels.find((p) => p.id === panelId);
    if (!panel) {
      await interaction.editReply({ content: "⚠️ This role panel could not be found." });
      return;
    }

    // Gate checks
    const gateError = this.checkRoleGates(member, panel);
    if (gateError) {
      await interaction.editReply({ content: gateError });
      return;
    }

    const option = panel.options.find((o) => o.id === optionId);
    if (!option) {
      await interaction.editReply({ content: "⚠️ This role option is no longer available." });
      return;
    }

    const role = interaction.guild!.roles.cache.get(option.roleId) ?? (await interaction.guild!.roles.fetch(option.roleId).catch(() => null));
    if (!role) {
      await interaction.editReply({ content: "⚠️ The configured Discord role no longer exists in this server." });
      return;
    }

    // Hierarchy check: Bot's highest role must be higher than the target role
    if (role.position >= me.roles.highest.position) {
      await interaction.editReply({
        content: `⚠️ The **${role.name}** role is positioned higher than the bot's highest role. Please ask a server admin to move the Bot's role above it in **Server Settings > Roles**.`,
      });
      return;
    }

    const hasRole = member.roles.cache.has(role.id);

    if (hasRole) {
      // Toggle OFF: Remove role
      try {
        await member.roles.remove(role);
        await this.logEvent(interaction.guild!.id, {
          panelId: panel.id,
          panelName: panel.name,
          userId: member.id,
          userName: member.user.username,
          action: "REMOVE",
          roleId: role.id,
          roleName: role.name,
          config,
          guild: interaction.guild!,
        });
        await interaction.editReply({ content: `❌ Removed role **${role.name}** from your profile.` });
      } catch (err) {
        this.logger.error("role-panel-manager: failed to remove role", { roleId: role.id, err });
        await interaction.editReply({ content: "⚠️ Failed to remove role. Please check bot permissions." });
      }
    } else {
      // Toggle ON: Add role
      try {
        // If panel is EXCLUSIVE, remove any existing roles from this panel
        if (panel.mode === "EXCLUSIVE") {
          for (const otherOpt of panel.options) {
            if (otherOpt.roleId !== role.id && member.roles.cache.has(otherOpt.roleId)) {
              await member.roles.remove(otherOpt.roleId).catch(() => {});
            }
          }
        }

        await member.roles.add(role);
        await this.logEvent(interaction.guild!.id, {
          panelId: panel.id,
          panelName: panel.name,
          userId: member.id,
          userName: member.user.username,
          action: "ADD",
          roleId: role.id,
          roleName: role.name,
          config,
          guild: interaction.guild!,
        });
        await interaction.editReply({ content: `✅ Added role **${role.name}** to your profile!` });
      } catch (err) {
        this.logger.error("role-panel-manager: failed to add role", { roleId: role.id, err });
        await interaction.editReply({ content: "⚠️ Failed to assign role. Please check bot permissions." });
      }
    }
  }

  private async handleSelectMenu(
    interaction: StringSelectMenuInteraction,
    member: GuildMember,
    me: GuildMember,
    config: StoredRolePanelsConfig,
  ): Promise<void> {
    // Custom ID format: role_panel:select:<panelId>
    const parts = interaction.customId.split(":");
    const panelId = parts[2];

    const panel = config.panels.find((p) => p.id === panelId);
    if (!panel) {
      await interaction.editReply({ content: "⚠️ This role panel could not be found." });
      return;
    }

    // Gate checks
    const gateError = this.checkRoleGates(member, panel);
    if (gateError) {
      await interaction.editReply({ content: gateError });
      return;
    }

    const selectedOptionIds = new Set(interaction.values);
    const addedRoleNames: string[] = [];
    const removedRoleNames: string[] = [];

    for (const option of panel.options) {
      const role = interaction.guild!.roles.cache.get(option.roleId) ?? (await interaction.guild!.roles.fetch(option.roleId).catch(() => null));
      if (!role) continue;

      if (role.position >= me.roles.highest.position) {
        continue; // Skip roles the bot cannot manage
      }

      const isSelected = selectedOptionIds.has(option.id);
      const currentlyHas = member.roles.cache.has(role.id);

      if (isSelected && !currentlyHas) {
        try {
          await member.roles.add(role);
          addedRoleNames.push(role.name);
          await this.logEvent(interaction.guild!.id, {
            panelId: panel.id,
            panelName: panel.name,
            userId: member.id,
            userName: member.user.username,
            action: "ADD",
            roleId: role.id,
            roleName: role.name,
            config,
            guild: interaction.guild!,
          });
        } catch {
          // Ignore individual role assignment error
        }
      } else if (!isSelected && currentlyHas) {
        try {
          await member.roles.remove(role);
          removedRoleNames.push(role.name);
          await this.logEvent(interaction.guild!.id, {
            panelId: panel.id,
            panelName: panel.name,
            userId: member.id,
            userName: member.user.username,
            action: "REMOVE",
            roleId: role.id,
            roleName: role.name,
            config,
            guild: interaction.guild!,
          });
        } catch {
          // Ignore individual role removal error
        }
      }
    }

    if (addedRoleNames.length === 0 && removedRoleNames.length === 0) {
      await interaction.editReply({ content: "ℹ️ No changes made to your roles." });
      return;
    }

    const partsMessage: string[] = [];
    if (addedRoleNames.length > 0) {
      partsMessage.push(`✅ **Added**: ${addedRoleNames.map((n) => `\`${n}\``).join(", ")}`);
    }
    if (removedRoleNames.length > 0) {
      partsMessage.push(`❌ **Removed**: ${removedRoleNames.map((n) => `\`${n}\``).join(", ")}`);
    }

    await interaction.editReply({ content: partsMessage.join("\n") });
  }

  private checkRoleGates(member: GuildMember, panel: StoredRolePanel): string | null {
    if (panel.requiredRoleId && !member.roles.cache.has(panel.requiredRoleId)) {
      return `⚠️ You must have the <@&${panel.requiredRoleId}> role before picking roles from this panel.`;
    }
    if (panel.forbiddenRoleId && member.roles.cache.has(panel.forbiddenRoleId)) {
      return `🚫 You cannot pick roles from this panel because you have the <@&${panel.forbiddenRoleId}> role.`;
    }
    return null;
  }

  private async logEvent(
    guildId: string,
    params: {
      panelId: string;
      panelName: string;
      userId: string;
      userName: string;
      action: "ADD" | "REMOVE";
      roleId: string;
      roleName: string;
      config: StoredRolePanelsConfig;
      guild: any;
    },
  ): Promise<void> {
    if (!params.config.loggingEnabled) return;

    // 1. Append to local storage
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
          // continue
        }
      }

      if (storageTenantsDir) {
        const tenants = await fs.readdir(storageTenantsDir, { withFileTypes: true }).catch(() => []);
        for (const tenant of tenants) {
          if (!tenant.isDirectory()) continue;
          const guildDir = path.join(storageTenantsDir, tenant.name, "guilds", guildId);
          try {
            await fs.access(guildDir);
            const logsFile = path.join(guildDir, "roles-logs.json");
            let logs: any[] = [];
            try {
              const content = await fs.readFile(logsFile, "utf-8");
              logs = JSON.parse(content);
            } catch {
              logs = [];
            }
            const newEntry = {
              id: Date.now().toString(),
              panelId: params.panelId,
              panelName: params.panelName,
              userId: params.userId,
              userName: params.userName,
              action: params.action,
              roleId: params.roleId,
              roleName: params.roleName,
              timestamp: new Date().toISOString(),
            };
            const updated = [newEntry, ...logs].slice(0, 100);
            await fs.writeFile(logsFile, JSON.stringify(updated, null, 2), "utf-8");
            break;
          } catch {
            // Next tenant
          }
        }
      }
    } catch (err) {
      this.logger.debug?.("role-panel-manager: logging error", { err });
    }

    // 2. Dispatch to Discord Log Channel if configured
    if (params.config.logChannelId) {
      try {
        const logChannel = await params.guild.channels.fetch(params.config.logChannelId).catch(() => null);
        if (logChannel && typeof logChannel.send === "function") {
          const isAdd = params.action === "ADD";
          const embed = new EmbedBuilder()
            .setTitle(isAdd ? "Role Granted" : "Role Removed")
            .setColor(isAdd ? 0x22c55e : 0xef4444)
            .setDescription(
              `<@${params.userId}> ${isAdd ? "claimed" : "removed"} **@${params.roleName}** via **${params.panelName}**.`,
            )
            .setTimestamp();
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch {
        // Non-fatal
      }
    }
  }

  private async findRolePanelsConfig(guildId: string): Promise<StoredRolePanelsConfig | null> {
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
        const panelFile = path.join(storageTenantsDir, tenant.name, "guilds", guildId, "roles-panels.json");
        try {
          const content = await fs.readFile(panelFile, "utf-8");
          return JSON.parse(content) as StoredRolePanelsConfig;
        } catch {
          // Next tenant
        }
      }
    } catch (err) {
      this.logger.debug?.("role-panel-manager: error searching storage", { guildId, err });
    }
    return null;
  }
}
