import { Client, GatewayIntentBits, Partials, type ApplicationCommandDataResolvable } from "discord.js";

/**
 * Interface abstracting Discord Gateway Client capabilities needed by CreatorCore.
 * Allows deterministic unit and integration testing with fake clients.
 */
export interface IDiscordClient {
  login(token: string): Promise<string>;
  destroy(): Promise<void> | void;
  isReady(): boolean;
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  removeListener(event: string, listener: (...args: unknown[]) => void): this;
  registerCommands?(commands: unknown[]): Promise<void>;
  getPing?(): number;
  setPresence?(presence: unknown): unknown;
  fetchChannel?(channelId: string): Promise<unknown>;
  fetchGuild?(guildId: string): Promise<unknown>;
}

/**
 * Real Discord.js Client implementation with Guilds, GuildMembers, and Reactions intents.
 * GuildMembers intent is required for member onboarding, auto-roles, and welcome messages.
 */
export class RealDiscordClient implements IDiscordClient {
  private client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
    });
  }

  public async login(token: string): Promise<string> {
    return this.client.login(token);
  }

  public async destroy(): Promise<void> {
    await this.client.destroy();
  }

  public isReady(): boolean {
    return this.client.isReady();
  }

  public on(event: string, listener: (...args: unknown[]) => void): this {
    this.client.on(event, listener);
    return this;
  }

  public once(event: string, listener: (...args: unknown[]) => void): this {
    this.client.once(event, listener);
    return this;
  }

  public removeListener(event: string, listener: (...args: unknown[]) => void): this {
    this.client.removeListener(event, listener);
    return this;
  }

  /**
   * Registers slash commands with the Discord Application Commands API.
   * Clears global commands to prevent duplicate entries and registers guild-level commands
   * so they activate and update immediately without Discord global CDN caching delays.
   */
  public async registerCommands(commands: unknown[]): Promise<void> {
    const commandList = commands as ApplicationCommandDataResolvable[];
    if (this.client.application) {
      try {
        await this.client.application.commands.set([]);
      } catch {
        // Global cleanup is best effort
      }
    }

    for (const guild of this.client.guilds.cache.values()) {
      try {
        await guild.commands.set(commandList);
      } catch {
        // Guild-level registration is best effort
      }
    }
  }

  public getPing(): number {
    return this.client.ws.ping;
  }

  public setPresence(presence: unknown): unknown {
    if (!this.client.user) return;
    return this.client.user.setPresence(presence as any);
  }

  public async fetchChannel(channelId: string): Promise<unknown> {
    try {
      return await this.client.channels.fetch(channelId);
    } catch {
      return null;
    }
  }

  public async fetchGuild(guildId: string): Promise<unknown> {
    try {
      return await this.client.guilds.fetch(guildId);
    } catch {
      return null;
    }
  }
}

export type DiscordClientFactory = () => IDiscordClient;

export const defaultDiscordClientFactory: DiscordClientFactory = () => new RealDiscordClient();
