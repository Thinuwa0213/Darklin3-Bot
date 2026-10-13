"use server";

import { callApiServer } from "../lib/api";
import { writeStoredPresence } from "../lib/presence-storage";
import { writeStoredWelcome } from "../lib/welcome-storage";
import {
  writeStoredLevelSettings,
  readStoredLevelSettings,
  readStoredGuildUsers,
  type LevelSettings,
  type UserXpRecord,
} from "../lib/levels-storage";
import {
  writeStoredStreams,
  readStoredStreams,
  type StoredStreamsConfig,
  type CommunityRadarConfig,
} from "../lib/streams-storage";
import {
  readStoredSettings,
  writeStoredSettings,
  type GuildSettings,
} from "../lib/settings-storage";
import {
  readStoredRolePanels,
  writeStoredRolePanels,
  readStoredRoleLogs,
  type RolePanelsConfig,
  type RoleAssignmentLog,
} from "../lib/roles-storage";
import {
  readStoredBoosterConfig,
  writeStoredBoosterConfig,
  type BoosterConfig,
} from "../lib/booster-storage";
import {
  readStoredActionLogsConfig,
  writeStoredActionLogsConfig,
  type ActionLogsConfig,
} from "../lib/action-logs-storage";
import {
  readStoredModerationConfig,
  writeStoredModerationConfig,
  type ModerationConfig,
} from "../lib/moderation-storage";
import {
  readStoredConsoleLogs,
  appendStoredConsoleLog,
  clearStoredConsoleLogs,
  type GuildConsoleLogEntry,
  type ConsoleLogLevel,
  type ConsoleLogCategory,
} from "../lib/console-logs-storage";
import {
  readStoredInvites,
  writeStoredInvites,
  type InvitesConfig,
} from "../lib/invites-storage";
import type {
  WelcomeConfig,
  LiveDiscordChannel,
  LiveDiscordRole,
  LiveDiscordEmoji,
} from "./tenants/[tenantId]/guilds/[guildId]/modules/welcome/welcome-types";

export interface ConnectGuildActionResult {
  ok: boolean;
  tenantId?: string;
  error?: string;
}

export interface OnboardBotActionResult {
  ok: boolean;
  botApplicationId?: string;
  error?: string;
}

/**
 * Server Action to connect an authorized Discord guild to CreatorCore.
 * Calls `POST /app/guilds/:guildId/connect` in apps/api with forwarded session and origin.
 */
export async function connectGuildAction(guildId: string): Promise<ConnectGuildActionResult> {
  if (!guildId || !/^[0-9]{1,20}$/.test(guildId)) {
    return { ok: false, error: "INVALID_GUILD_ID" };
  }

  const res = await callApiServer<{ ok: boolean; tenantId: string; guildId: string }>(
    `/app/guilds/${guildId}/connect`,
    { method: "POST" },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to connect guild" };
  }

  return { ok: true, tenantId: res.data.tenantId };
}

/**
 * Server Action to onboard a BotApplication with initial encrypted credential.
 * Calls `POST /app/tenants/:tenantId/guilds/:guildId/bot-application` in apps/api.
 *
 * Security guarantees:
 * - Token is forwarded directly to apps/api for envelope encryption
 * - Token is NEVER returned in this action result payload
 * - Token is NEVER serialized back to the client
 */
export async function onboardBotAction(
  tenantId: string,
  guildId: string,
  name: string,
  token: string,
): Promise<OnboardBotActionResult> {
  if (!tenantId || !guildId || !token) {
    return { ok: false, error: "Missing required fields" };
  }

  const res = await callApiServer<{ botApplicationId: string; status: string }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/bot-application`,
    {
      method: "POST",
      body: { name, token },
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to configure bot application" };
  }

  return { ok: true, botApplicationId: res.data.botApplicationId };
}

export interface RotateBotCredentialActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Server Action to rotate a BotApplication credential.
 * Calls `POST /app/tenants/:tenantId/bot-applications/:botApplicationId/credential/rotate` in apps/api.
 *
 * Security guarantees:
 * - Token is forwarded directly to apps/api for envelope encryption and rotation
 * - Token is NEVER returned in this action result payload
 * - Token is NEVER serialized back to the client
 */
export async function rotateBotCredentialAction(
  tenantId: string,
  botApplicationId: string,
  token: string,
): Promise<RotateBotCredentialActionResult> {
  if (!tenantId || !botApplicationId || !token) {
    return { ok: false, error: "Missing required fields" };
  }

  const res = await callApiServer<{ status: string }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/bot-applications/${encodeURIComponent(botApplicationId)}/credential/rotate`,
    {
      method: "POST",
      body: { token },
    },
  );

  if (!res.ok) {
    return { ok: false, error: res.error ?? "Failed to rotate bot credentials" };
  }

  return { ok: true };
}

export interface BillingActionResult {
  ok: boolean;
  plan?: string;
  error?: string;
}

/**
 * Server Action to upgrade or change a tenant's subscription plan.
 */
export async function upgradePlanAction(
  tenantId: string,
  plan: "FREE" | "PRO" | "ENTERPRISE",
  interval: "month" | "year",
): Promise<BillingActionResult> {
  if (!tenantId || !plan) {
    return { ok: false, error: "Missing required fields" };
  }

  const res = await callApiServer<{ success: boolean; plan: string }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/billing/checkout`,
    {
      method: "POST",
      body: { plan, interval },
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to update plan" };
  }

  return { ok: true, plan: res.data.plan };
}

/**
 * Server Action to cancel or downgrade a tenant's subscription plan.
 */
export async function cancelPlanAction(tenantId: string): Promise<BillingActionResult> {
  if (!tenantId) {
    return { ok: false, error: "Missing tenant ID" };
  }

  const res = await callApiServer<{ success: boolean; plan: string }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/billing/cancel`,
    {
      method: "POST",
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to cancel subscription" };
  }

  return { ok: true, plan: res.data.plan };
}

export interface BrandingUploadActionResult {
  ok: boolean;
  avatarUrl?: string | undefined;
  bannerUrl?: string | undefined;
  fileSizeBytes?: number | undefined;
  usedStorageBytes?: number | undefined;
  maxStorageBytes?: number | undefined;
  error?: string | undefined;
}

export interface BrandingSaveActionResult {
  ok: boolean;
  syncedWithDiscord?: boolean | undefined;
  retryAfterSeconds?: number | undefined;
  error?: string | undefined;
}

/**
 * Server Action to upload custom avatar image to storage.
 * Supports FormData (avoids React 19 Flight nested array recursion) or legacy parameters.
 */
export async function uploadBrandingAvatarAction(
  tenantIdOrFormData: string | FormData,
  guildId?: string,
  dataUriOrFormData?: string | FormData,
  fileName?: string,
): Promise<BrandingUploadActionResult> {
  let tenantId = "";
  let targetGuildId = "";
  let bodyToSend: unknown;

  if (tenantIdOrFormData instanceof FormData) {
    tenantId = (tenantIdOrFormData.get("tenantId") as string) || "";
    targetGuildId = (tenantIdOrFormData.get("guildId") as string) || "";
    const file = tenantIdOrFormData.get("avatar");
    if (file instanceof File) {
      const cleanFormData = new FormData();
      cleanFormData.append("avatar", file);
      bodyToSend = cleanFormData;
    } else {
      bodyToSend = tenantIdOrFormData;
    }
  } else {
    tenantId = tenantIdOrFormData;
    targetGuildId = guildId || "";
    if (dataUriOrFormData instanceof FormData) {
      const file = dataUriOrFormData.get("avatar");
      if (file instanceof File) {
        const cleanFormData = new FormData();
        cleanFormData.append("avatar", file);
        bodyToSend = cleanFormData;
      } else {
        bodyToSend = dataUriOrFormData;
      }
    } else {
      bodyToSend = { dataUri: dataUriOrFormData, fileName: fileName || "avatar.png" };
    }
  }

  if (!tenantId || !targetGuildId) {
    return { ok: false, error: "Missing required upload parameters" };
  }

  const res = await callApiServer<{
    ok: boolean;
    avatarUrl: string;
    fileSizeBytes: number;
    usedStorageBytes: number;
    maxStorageBytes: number;
    message?: string;
  }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(targetGuildId)}/branding/avatar`,
    {
      method: "POST",
      body: bodyToSend,
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to upload avatar" };
  }

  return {
    ok: true,
    avatarUrl: res.data.avatarUrl,
    fileSizeBytes: res.data.fileSizeBytes,
    usedStorageBytes: res.data.usedStorageBytes,
    maxStorageBytes: res.data.maxStorageBytes,
  };
}

/**
 * Server Action to upload custom banner image to storage.
 * Supports FormData (avoids React 19 Flight nested array recursion) or legacy parameters.
 */
export async function uploadBrandingBannerAction(
  tenantIdOrFormData: string | FormData,
  guildId?: string,
  dataUriOrFormData?: string | FormData,
  fileName?: string,
): Promise<BrandingUploadActionResult> {
  let tenantId = "";
  let targetGuildId = "";
  let bodyToSend: unknown;

  if (tenantIdOrFormData instanceof FormData) {
    tenantId = (tenantIdOrFormData.get("tenantId") as string) || "";
    targetGuildId = (tenantIdOrFormData.get("guildId") as string) || "";
    const file = tenantIdOrFormData.get("banner");
    if (file instanceof File) {
      const cleanFormData = new FormData();
      cleanFormData.append("banner", file);
      bodyToSend = cleanFormData;
    } else {
      bodyToSend = tenantIdOrFormData;
    }
  } else {
    tenantId = tenantIdOrFormData;
    targetGuildId = guildId || "";
    if (dataUriOrFormData instanceof FormData) {
      const file = dataUriOrFormData.get("banner");
      if (file instanceof File) {
        const cleanFormData = new FormData();
        cleanFormData.append("banner", file);
        bodyToSend = cleanFormData;
      } else {
        bodyToSend = dataUriOrFormData;
      }
    } else {
      bodyToSend = { dataUri: dataUriOrFormData, fileName: fileName || "banner.png" };
    }
  }

  if (!tenantId || !targetGuildId) {
    return { ok: false, error: "Missing required upload parameters" };
  }

  const res = await callApiServer<{
    ok: boolean;
    bannerUrl: string;
    fileSizeBytes: number;
    usedStorageBytes: number;
    maxStorageBytes: number;
    message?: string;
  }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(targetGuildId)}/branding/banner`,
    {
      method: "POST",
      body: bodyToSend,
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to upload banner" };
  }

  return {
    ok: true,
    bannerUrl: res.data.bannerUrl,
    fileSizeBytes: res.data.fileSizeBytes,
    usedStorageBytes: res.data.usedStorageBytes,
    maxStorageBytes: res.data.maxStorageBytes,
  };
}

/**
 * Server Action to apply branding changes and sync with Discord API.
 */
export async function saveBrandingAction(
  tenantId: string,
  guildId: string,
  options: {
    nickname?: string;
    syncAvatarToDiscord?: boolean;
    syncBannerToDiscord?: boolean;
  },
): Promise<BrandingSaveActionResult> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  const res = await callApiServer<{
    ok: boolean;
    syncedWithDiscord?: boolean;
    error?: string;
    retryAfterSeconds?: number;
  }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding/save`,
    {
      method: "POST",
      body: options,
    },
  );

  if (!res.ok || !res.data) {
    return {
      ok: false,
      error: res.error ?? "Failed to save branding changes",
    };
  }

  return {
    ok: res.data.ok,
    syncedWithDiscord: res.data.syncedWithDiscord,
    retryAfterSeconds: res.data.retryAfterSeconds,
    error: res.data.error,
  };
}

/**
 * Server Action to remove custom avatar and free up quota.
 */
export async function removeBrandingAvatarAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; usedStorageBytes?: number; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  const res = await callApiServer<{ ok: boolean; usedStorageBytes: number }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding/avatar`,
    {
      method: "DELETE",
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to remove avatar" };
  }

  return { ok: true, usedStorageBytes: res.data.usedStorageBytes };
}

/**
 * Server Action to remove custom banner and free up quota.
 */
export async function removeBrandingBannerAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; usedStorageBytes?: number; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  const res = await callApiServer<{ ok: boolean; usedStorageBytes: number }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding/banner`,
    {
      method: "DELETE",
    },
  );

  if (!res.ok || !res.data) {
    return { ok: false, error: res.error ?? "Failed to remove banner" };
  }

  return { ok: true, usedStorageBytes: res.data.usedStorageBytes };
}

export interface SavePresenceActionResult {
  ok: boolean;
  error?: string;
  data?: {
    statusMode: "online" | "idle" | "dnd";
    rotationInterval: number;
    activities: {
      id: string;
      type: "WATCHING" | "PLAYING" | "LISTENING" | "STREAMING" | "COMPETING";
      text: string;
      streamUrl?: string;
    }[];
  };
}

/**
 * Server Action to save Rich Presence settings (online status, rotation interval, rotating activities).
 * Persists data to the control-plane API per tenant and guild.
 */
export async function savePresenceAction(
  tenantId: string,
  guildId: string,
  data: {
    statusMode: "online" | "idle" | "dnd";
    rotationInterval: number;
    activities: {
      id: string;
      type: string;
      text: string;
      streamUrl?: string;
    }[];
  },
): Promise<SavePresenceActionResult> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  try {
    const res = await callApiServer<{
      ok: boolean;
      statusMode: "online" | "idle" | "dnd";
      rotationInterval: number;
      activities: {
        id: string;
        type: "WATCHING" | "PLAYING" | "LISTENING" | "STREAMING" | "COMPETING";
        text: string;
        streamUrl?: string;
      }[];
      error?: string;
    }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/presence`,
      {
        method: "POST",
        body: data,
      },
    );

    if (res.ok && res.data) {
      return { ok: true, data: res.data };
    }
  } catch {
    // API server may be rebuilding or route not mounted in running bundle; proceed to persistent storage fallback
  }

  // Robust direct filesystem persistence fallback
  try {
    const saved = await writeStoredPresence(tenantId, guildId, data);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save presence configuration" };
  }
}

export interface SaveWelcomeActionResult {
  ok: boolean;
  error?: string;
  data?: WelcomeConfig;
}

/**
 * Server Action to save Welcome Module settings (message template, channel, auto-role, banner config).
 * Persists data to the control-plane API or filesystem storage fallback.
 */
export async function saveWelcomeAction(
  tenantId: string,
  guildId: string,
  data: WelcomeConfig,
): Promise<SaveWelcomeActionResult> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  try {
    const res = await callApiServer<{
      ok: boolean;
      data: WelcomeConfig;
      error?: string;
    }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/welcome`,
      {
        method: "POST",
        body: data,
      },
    );

    if (res.ok && res.data) {
      return { ok: true, data: res.data.data };
    }
  } catch {
    // API server may not have this route yet; fallback to direct storage
  }

  try {
    const saved = await writeStoredWelcome(tenantId, guildId, data);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save welcome configuration" };
  }
}

export interface DiscordResourcesActionResult {
  ok: boolean;
  error?: string;
  data?: {
    guildName: string;
    channels: LiveDiscordChannel[];
    roles: LiveDiscordRole[];
    emojis?: LiveDiscordEmoji[];
  };
}

/**
 * Server Action to fetch live Discord channels, roles, and custom emojis for a connected guild.
 */
export async function refreshGuildDiscordResourcesAction(
  tenantId: string,
  guildId: string,
): Promise<DiscordResourcesActionResult> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  const res = await callApiServer<{
    ok: boolean;
    data: {
      guildName: string;
      channels: LiveDiscordChannel[];
      roles: LiveDiscordRole[];
      emojis?: LiveDiscordEmoji[];
    };
    error?: string;
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`);

  if (res.ok && res.data?.data) {
    return { ok: true, data: res.data.data };
  }

  return { ok: false, error: res.error || "Failed to fetch live Discord resources" };
}

export interface SaveLevelSettingsActionResult {
  ok: boolean;
  error?: string;
  data?: LevelSettings;
}

/**
 * Server Action to save Leveling & XP settings (min/max XP, cooldown, announcement channel, role rewards).
 */
export async function saveLevelSettingsAction(
  tenantId: string,
  guildId: string,
  data: LevelSettings,
): Promise<SaveLevelSettingsActionResult> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }

  try {
    const saved = await writeStoredLevelSettings(tenantId, guildId, data);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save leveling configuration" };
  }
}

/**
 * Server Action to retrieve Leveling & XP settings for a guild.
 */
export async function getLevelSettingsAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; data?: LevelSettings; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const data = await readStoredLevelSettings(tenantId, guildId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load leveling configuration" };
  }
}

/**
 * Server Action to retrieve the current leaderboard for a guild.
 */
export async function getLevelLeaderboardAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; data: UserXpRecord[]; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, data: [], error: "Missing tenant or guild ID" };
  }
  try {
    const users = await readStoredGuildUsers(tenantId, guildId);
    users.sort((a, b) => b.xp - a.xp);
    return { ok: true, data: users };
  } catch (err) {
    return { ok: false, data: [], error: (err as Error)?.message ?? "Failed to load leaderboard" };
  }
}

/**
 * Server Action to save Stream Alert settings for a guild.
 */
export async function saveStreamAlertsAction(
  tenantId: string,
  guildId: string,
  config: Partial<StoredStreamsConfig>,
): Promise<{ ok: boolean; data?: StoredStreamsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const data = await writeStoredStreams(tenantId, guildId, config);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save stream alert settings" };
  }
}

/**
 * Server Action to retrieve Stream Alert settings for a guild.
 */
export async function getStreamAlertsAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; data?: StoredStreamsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const data = await readStoredStreams(tenantId, guildId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load stream alert settings" };
  }
}

/**
 * Server Action to save Community Stream Radar settings for a guild.
 */
export async function saveCommunityRadarAction(
  tenantId: string,
  guildId: string,
  radarConfig: CommunityRadarConfig,
): Promise<{ ok: boolean; data?: StoredStreamsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const existing = await readStoredStreams(tenantId, guildId);
    const updated = await writeStoredStreams(tenantId, guildId, {
      ...existing,
      communityRadar: radarConfig,
    });
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save community radar settings" };
  }
}

/**
 * Server Action to retrieve Community Stream Radar settings for a guild.
 */
export async function getCommunityRadarAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; data?: CommunityRadarConfig | undefined; error?: string | undefined }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const data = await readStoredStreams(tenantId, guildId);
    return { ok: true, data: data.communityRadar };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load community radar settings" };
  }
}

/**
 * Server Action to save centralized Guild & Bot Settings.
 */
export async function saveGuildSettingsAction(
  tenantId: string,
  guildId: string,
  settings: GuildSettings,
): Promise<{ ok: boolean; data?: GuildSettings; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    await writeStoredSettings(tenantId, guildId, settings);
    return { ok: true, data: settings };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save guild settings" };
  }
}

/**
 * Server Action to retrieve centralized Guild & Bot Settings.
 */
export async function getGuildSettingsAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; data?: GuildSettings; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const data = await readStoredSettings(tenantId, guildId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load guild settings" };
  }
}

/**
 * Server Action to retrieve Role Panels configuration.
 */
export async function getRolePanelsAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; data?: RolePanelsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const data = await readStoredRolePanels(tenantId, guildId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load role panels" };
  }
}

/**
 * Server Action to save Role Panels configuration.
 */
export async function saveRolePanelsAction(
  tenantId: string,
  guildId: string,
  config: RolePanelsConfig,
): Promise<{ ok: boolean; data?: RolePanelsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const saved = await writeStoredRolePanels(tenantId, guildId, config);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save role panels" };
  }
}

/**
 * Server Action to publish a Role Panel to its destination Discord channel.
 * Calls apps/api to construct Embed + ActionRow components and posts/updates via Discord REST API.
 */
export async function publishRolePanelAction(
  tenantId: string,
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!tenantId || !guildId || !panelId) {
    return { ok: false, error: "Missing required parameters" };
  }
  try {
    const config = await readStoredRolePanels(tenantId, guildId);
    const panelIndex = config.panels.findIndex((p) => p.id === panelId);
    if (panelIndex === -1) {
      return { ok: false, error: "Role panel not found" };
    }

    const panel = config.panels[panelIndex];
    if (!panel) {
      return { ok: false, error: "Role panel is undefined" };
    }
    if (!panel.channelId) {
      return { ok: false, error: "Please select a target channel first" };
    }
    if (panel.options.length === 0) {
      return { ok: false, error: "Please configure at least one role option" };
    }

    const res = await callApiServer<{ ok: boolean; messageId: string }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/roles-panels/${encodeURIComponent(panelId)}/publish`,
      {
        method: "POST",
        body: { panel },
      },
    );

    if (!res.ok || !res.data) {
      const errorMsg = res.error || "Failed to publish panel to Discord";
      panel.status = "ERROR";
      panel.lastError = errorMsg;
      await writeStoredRolePanels(tenantId, guildId, config);
      return { ok: false, error: errorMsg };
    }

    panel.messageId = res.data.messageId;
    panel.publishedAt = new Date().toISOString();
    panel.status = "PUBLISHED";
    panel.lastError = undefined;

    await writeStoredRolePanels(tenantId, guildId, config);
    return { ok: true, messageId: res.data.messageId };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Publishing failed" };
  }
}

/**
 * Server Action to delete a Role Panel and remove its published message from Discord.
 */
export async function deleteRolePanelAction(
  tenantId: string,
  guildId: string,
  panelId: string,
  targetChannelId?: string,
  targetMessageId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!tenantId || !guildId || !panelId) {
    return { ok: false, error: "Missing required parameters" };
  }
  try {
    const config = await readStoredRolePanels(tenantId, guildId);
    const panel = config.panels.find((p) => p.id === panelId);

    const channelId = targetChannelId || panel?.channelId;
    const messageId = targetMessageId || panel?.messageId;

    if (messageId && channelId) {
      // Best-effort delete message from Discord
      const delRes = await callApiServer(
        `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/roles-panels/${encodeURIComponent(panelId)}/discord-message?channelId=${encodeURIComponent(channelId)}&messageId=${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      ).catch((err) => {
        console.warn("[deleteRolePanelAction] Discord delete call error:", err);
        return { ok: false };
      });
      if (delRes && !delRes.ok) {
        console.warn("[deleteRolePanelAction] Failed to delete Discord message:", delRes);
      }
    }

    config.panels = config.panels.filter((p) => p.id !== panelId);
    await writeStoredRolePanels(tenantId, guildId, config);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to delete role panel" };
  }
}

/**
 * Server Action to fetch Role Assignment Audit Logs.
 */
export async function getRoleLogsAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; logs?: RoleAssignmentLog[]; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const logs = await readStoredRoleLogs(tenantId, guildId);
    return { ok: true, logs };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load role logs" };
  }
}

/**
 * Server Action to fetch Server Booster configuration.
 */
export async function getBoosterConfigAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; config?: BoosterConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const config = await readStoredBoosterConfig(tenantId, guildId);
    return { ok: true, config };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load booster configuration" };
  }
}

/**
 * Server Action to save Server Booster configuration.
 */
export async function saveBoosterConfigAction(
  tenantId: string,
  guildId: string,
  data: BoosterConfig,
): Promise<{ ok: boolean; config?: BoosterConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const saved = await writeStoredBoosterConfig(tenantId, guildId, data);
    return { ok: true, config: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save booster configuration" };
  }
}

/**
 * Server Action to dispatch a Test Server Booster Alert directly to Discord.
 */
export async function sendTestBoostAlertAction(
  tenantId: string,
  guildId: string,
  data: BoosterConfig,
): Promise<{ ok: boolean; messageId?: string | undefined; error?: string }> {
  if (!tenantId || !guildId || !data.channelId) {
    return { ok: false, error: "Please select an announcement channel first." };
  }
  try {
    const res = await callApiServer<{ ok: boolean; messageId?: string; error?: string }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/booster/test-alert`,
      {
        method: "POST",
        body: data,
      },
    );
    if (res.ok && res.data?.ok) {
      return { ok: true, messageId: res.data.messageId };
    }
    return { ok: false, error: res.error || res.data?.error || "Discord test alert failed" };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to send test alert" };
  }
}

/**
 * Server Action to publish a visual custom embed to Discord.
 */
export async function publishEmbedToDiscordAction(
  tenantId: string,
  guildId: string,
  channelId: string,
  embed: any,
  content?: string,
): Promise<{ ok: boolean; messageId?: string | undefined; error?: string }> {
  if (!tenantId || !guildId || !channelId || !embed) {
    return { ok: false, error: "Missing required parameters" };
  }
  try {
    const res = await callApiServer<{ ok: boolean; messageId?: string; error?: string }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/embeds/publish`,
      {
        method: "POST",
        body: { channelId, embed, content },
      },
    );
    if (res.ok && res.data?.ok) {
      return { ok: true, messageId: res.data.messageId };
    }
    return { ok: false, error: res.error || res.data?.error || "Publishing embed failed" };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to publish embed" };
  }
}

/**
 * Server Action to fetch Action Logs configuration.
 */
export async function getActionLogsConfigAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; config?: ActionLogsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const config = await readStoredActionLogsConfig(tenantId, guildId);
    return { ok: true, config };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load action logs configuration" };
  }
}

/**
 * Server Action to save Action Logs configuration.
 */
export async function saveActionLogsConfigAction(
  tenantId: string,
  guildId: string,
  data: ActionLogsConfig,
): Promise<{ ok: boolean; config?: ActionLogsConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const saved = await writeStoredActionLogsConfig(tenantId, guildId, data);
    return { ok: true, config: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save action logs configuration" };
  }
}

/**
 * Server Action to fetch Auto-Moderation configuration.
 */
export async function getModerationConfigAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; config?: ModerationConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const config = await readStoredModerationConfig(tenantId, guildId);
    return { ok: true, config };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load moderation configuration" };
  }
}

/**
 * Server Action to save Auto-Moderation configuration.
 */
export async function saveModerationConfigAction(
  tenantId: string,
  guildId: string,
  data: ModerationConfig,
): Promise<{ ok: boolean; config?: ModerationConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const saved = await writeStoredModerationConfig(tenantId, guildId, data);
    return { ok: true, config: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save moderation configuration" };
  }
}

/**
 * Server Action to fetch live console logs for a guild.
 */
export async function getGuildConsoleLogsAction(
  tenantId: string,
  guildId: string,
  guildTimezone = "Asia/Colombo",
): Promise<{ ok: boolean; logs?: GuildConsoleLogEntry[]; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const logs = await readStoredConsoleLogs(tenantId, guildId, guildTimezone);
    return { ok: true, logs };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load console logs" };
  }
}

/**
 * Server Action to clear console logs for a guild.
 */
export async function clearGuildConsoleLogsAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    await clearStoredConsoleLogs(tenantId, guildId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to clear console logs" };
  }
}

/**
 * Server Action to append a console log (e.g. for testing or event dispatching).
 */
export async function appendGuildConsoleLogAction(
  tenantId: string,
  guildId: string,
  entry: {
    level: ConsoleLogLevel;
    category?: ConsoleLogCategory;
    message: string;
    details?: string;
  },
): Promise<{ ok: boolean; log?: GuildConsoleLogEntry; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const log = await appendStoredConsoleLog(tenantId, guildId, entry);
    return { ok: true, log };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to append console log" };
  }
}

/**
 * Server Action to fetch Invites configuration for a guild.
 */
export async function getInvitesConfigAction(
  tenantId: string,
  guildId: string,
): Promise<{ ok: boolean; config?: InvitesConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const config = await readStoredInvites(tenantId, guildId);
    return { ok: true, config };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to load invites configuration" };
  }
}

/**
 * Server Action to save Invites configuration for a guild.
 */
export async function saveInvitesConfigAction(
  tenantId: string,
  guildId: string,
  data: InvitesConfig,
): Promise<{ ok: boolean; config?: InvitesConfig; error?: string }> {
  if (!tenantId || !guildId) {
    return { ok: false, error: "Missing tenant or guild ID" };
  }
  try {
    const saved = await writeStoredInvites(tenantId, guildId, data);
    return { ok: true, config: saved };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to save invites configuration" };
  }
}

/**
 * Server Action to dispatch a simulated Test Invite Alert to Discord channel.
 */
export async function sendTestInviteAlertAction(
  tenantId: string,
  guildId: string,
  data: InvitesConfig,
): Promise<{ ok: boolean; messageId?: string | undefined; error?: string }> {
  if (!tenantId || !guildId || !data.channelId) {
    return { ok: false, error: "Please select an invite log channel first." };
  }
  try {
    const cleanChannelName = data.channelName ? `#${data.channelName.replace(/^#+/, "")}` : "#logs";

    const embed = {
      color: 0x23a55a, // Discord Green (#23a55a)
      title: "New Member Joined!",
      thumbnail: {
        url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=160&auto=format&fit=crop&q=80",
      },
      fields: [
        {
          name: "👤 Joined Member's Details",
          value: "• `@Alex_Rivers`\n• Username: `alex_rivers`\n• User ID: `982341059128471029`",
          inline: false,
        },
        {
          name: "👥 Invited By",
          value: "• `@CyberNova`\n• Username: `cybernova`\n• User ID: `731902481092847104`",
          inline: false,
        },
        {
          name: "🔗 Invite Link's Details",
          value: `• Code: [DEMO98X](https://discord.gg/)\n• Channel: ${cleanChannelName}\n• Created at: October 3, 2025 5:42 AM\n• Expires at: \`∞\`\n• Uses: \`4 / ∞\``,
          inline: false,
        },
      ],
      footer: { text: "⚡ Alert powered by Darklin3 Bot" },
      timestamp: new Date().toISOString(),
    };

    return await publishEmbedToDiscordAction(tenantId, guildId, data.channelId, embed);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to send test invite alert" };
  }
}






