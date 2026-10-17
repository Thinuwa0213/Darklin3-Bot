import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RolePanelManager } from "./role-panel-manager.js";
import type { IDiscordClient } from "./discord-client.js";
import type { Logger } from "@darklin3_bot/logger";

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("RolePanelManager", () => {
  let mockClient: IDiscordClient;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockClient = {
      login: vi.fn(),
      destroy: vi.fn(),
      isReady: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as IDiscordClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes and stops cleanly", async () => {
    const manager = new RolePanelManager(mockClient, mockLogger);
    await manager.start();

    expect(mockLogger.info).toHaveBeenCalledWith(
      "role-panel-manager: started and ready to handle component interactions",
    );

    manager.stop();
  });

  it("ignores non-guild interactions gracefully", async () => {
    const manager = new RolePanelManager(mockClient, mockLogger);
    await manager.start();

    const mockInteraction = {
      guildId: null,
      guild: null,
      replied: false,
      deferred: false,
      reply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await manager.handleInteraction(mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This action can only be used in a server.",
      ephemeral: true,
    });
  });

  it("defers reply immediately to avoid Discord timeout", async () => {
    const manager = new RolePanelManager(mockClient, mockLogger);
    await manager.start();

    const mockInteraction = {
      guildId: "guild-123",
      guild: { id: "guild-123" },
      replied: false,
      deferred: false,
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await manager.handleInteraction(mockInteraction);
    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });
});
