import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StreamManager } from "./stream-manager.js";
import type { IDiscordClient } from "./discord-client.js";
import type { Logger } from "@darklin3_bot/logger";
import { ActivityType } from "discord.js";

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("StreamManager", () => {
  let mockClient: IDiscordClient;
  let mockLogger: Logger;
  let eventListeners: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    eventListeners = new Map();

    mockClient = {
      login: vi.fn(),
      destroy: vi.fn(),
      isReady: vi.fn().mockReturnValue(true),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        eventListeners.set(event, listener);
        return mockClient;
      }),
      once: vi.fn(),
      removeListener: vi.fn((event: string) => {
        eventListeners.delete(event);
        return mockClient;
      }),
      fetchChannel: vi.fn(),
      fetchGuild: vi.fn(),
    } as unknown as IDiscordClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes and attaches presenceUpdate listener on start", async () => {
    const manager = new StreamManager(mockClient, mockLogger);
    await manager.start();

    expect(mockClient.on).toHaveBeenCalledWith("presenceUpdate", expect.any(Function));
    expect(mockLogger.info).toHaveBeenCalledWith(
      "stream-manager: started content alert & live auto-role service"
    );

    manager.stop();
    expect(mockClient.removeListener).toHaveBeenCalledWith("presenceUpdate", expect.any(Function));
    expect(mockLogger.info).toHaveBeenCalledWith(
      "stream-manager: stopped content alert & live auto-role service"
    );
  });

  it("handles Community Radar presence updates matching configured tags", async () => {
    const manager = new StreamManager(mockClient, mockLogger);
    await manager.start();

    const mockSend = vi.fn().mockResolvedValue({ id: "msg-123" });
    const mockChannel = { send: mockSend };
    vi.mocked(mockClient.fetchChannel!).mockResolvedValue(mockChannel);

    const mockRoleAdd = vi.fn().mockResolvedValue(undefined);
    const mockMember = {
      id: "user-456",
      displayName: "StreamerSLRP",
      displayAvatarURL: () => "https://avatar.url/pic.png",
      roles: {
        cache: new Map([["role-creator", { id: "role-creator", name: "Creator" }]]),
        add: mockRoleAdd,
      },
    };

    const mockGuild = {
      id: "guild-999",
      members: {
        fetch: vi.fn().mockResolvedValue(mockMember),
      },
      roles: {
        cache: new Map([["live-role-id", { id: "live-role-id", name: "Now Streaming" }]]),
      },
    };

    vi.mocked(mockClient.fetchGuild!).mockResolvedValue(mockGuild);

    // Call private handleCommunityRadarPresence directly for deterministic logic check
    const radarConfig = {
      enabled: true,
      keywords: ["[SLRP]"],
      gameFilter: "Grand Theft Auto V",
      requiredRoleId: "role-creator",
      liveRoleId: "live-role-id",
      discordChannelId: "channel-radar",
      pingRoleId: "everyone",
      customMessage: "🎮 **{member}** is streaming **{game}** with **{keyword}**!\n{url}",
      cooldownMinutes: 60,
    };

    const oldPresence = { activities: [] };
    const newPresence = {
      activities: [
        {
          type: ActivityType.Streaming,
          name: "Grand Theft Auto V",
          details: "Chill Night in the City [SLRP]",
          url: "https://twitch.tv/streamerslrp",
        },
      ],
    };

    // @ts-expect-error accessing private method for verification
    await manager.handleCommunityRadarPresence(
      mockGuild,
      mockMember,
      oldPresence,
      newPresence,
      radarConfig
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "@everyone",
      })
    );
    expect(mockRoleAdd).toHaveBeenCalled();

    manager.stop();
  });

  it("probes Kick API and structures live details correctly", async () => {
    const manager = new StreamManager(mockClient, mockLogger);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        livestream: {
          id: 98765,
          session_title: "Chillin on Kick",
          categories: [{ name: "Just Chatting" }],
          viewer_count: 320,
          thumbnail: { url: "https://thumb.kick.com/preview.jpg" },
        },
        user: { username: "kickcreator", profile_pic: "https://pic.kick.com/p.jpg" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // @ts-expect-error accessing private probeKick
    const result = await manager.probeKick("kickcreator");

    expect(result.isLive).toBe(true);
    expect(result.streamId).toBe("98765");
    expect(result.title).toBe("Chillin on Kick");
    expect(result.game).toBe("Just Chatting");
    expect(result.viewers).toBe(320);

    vi.unstubAllGlobals();
    manager.stop();
  });

  it("returns isLive false when Kick API responds with non-live state", async () => {
    const manager = new StreamManager(mockClient, mockLogger);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ livestream: null }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // @ts-expect-error accessing private probeKick
    const result = await manager.probeKick("offlinecreator");

    expect(result.isLive).toBe(false);

    vi.unstubAllGlobals();
    manager.stop();
  });

  it("sends live announcement with Darklin3 Bot default branding on Free tier", async () => {
    const manager = new StreamManager(mockClient, mockLogger);
    const mockSend = vi.fn().mockResolvedValue({ id: "msg-free" });
    const mockChannel = { send: mockSend };
    vi.mocked(mockClient.fetchChannel!).mockResolvedValue(mockChannel);

    const streamer = {
      id: "st-1",
      platform: "youtube" as const,
      channelName: "ALWIZ 2.0",
      channelUrl: "https://youtube.com/@Alwiz_2.0",
      discordChannelId: "channel-yt",
      pingRoleId: "everyone",
    };

    const liveDetails = {
      isLive: true,
      streamId: "YFPbHtVi06U",
      title: "Euro Truck Simulator 2 Live Stream",
    };

    const config = {
      enabled: true,
      autoCleanup: false,
      customLiveMessage: "Hey {role}, **{streamer}** is going to be live soon!\n{url}",
      streamers: [streamer],
      customBranding: false,
    };

    // @ts-expect-error accessing private sendLiveAnnouncement
    const msgId = await manager.sendLiveAnnouncement(streamer, liveDetails, config);

    expect(msgId).toBe("msg-free");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("https://www.youtube.com/watch?v=YFPbHtVi06U"),
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Euro Truck Simulator 2 Live Stream",
              url: "https://www.youtube.com/watch?v=YFPbHtVi06U",
              footer: expect.objectContaining({
                text: "⚡ Stream Alert powered by Darklin3 Bot • darklin3.app",
              }),
            }),
          }),
        ]),
      })
    );
  });

  it("supports white-label or custom footer when customBranding is true on PRO", async () => {
    const manager = new StreamManager(mockClient, mockLogger);
    const mockSend = vi.fn().mockResolvedValue({ id: "msg-pro" });
    const mockChannel = { send: mockSend };
    vi.mocked(mockClient.fetchChannel!).mockResolvedValue(mockChannel);

    const streamer = {
      id: "st-2",
      platform: "twitch" as const,
      channelName: "TwitchCreator",
      channelUrl: "https://twitch.tv/twitchcreator",
      discordChannelId: "channel-twitch",
      pingRoleId: "here",
    };

    const liveDetails = {
      isLive: true,
      streamId: "54321",
      title: "Speedrunning Elden Ring",
      game: "Elden Ring",
      viewers: 1500,
    };

    const config = {
      enabled: true,
      autoCleanup: false,
      customLiveMessage: "{role} **{streamer}** is LIVE!\n{url}",
      streamers: [streamer],
      customBranding: true,
      customFooterText: "Elite Gaming Guild Alerts",
    };

    // @ts-expect-error accessing private sendLiveAnnouncement
    const msgId = await manager.sendLiveAnnouncement(streamer, liveDetails, config);

    expect(msgId).toBe("msg-pro");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              footer: expect.objectContaining({
                text: "Elite Gaming Guild Alerts",
              }),
            }),
          }),
        ]),
      })
    );
  });
});
