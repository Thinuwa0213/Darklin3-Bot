import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_INVITES_CONFIG, type InvitesConfig, type InviteJoinRecord } from "./invites-types";

export { DEFAULT_INVITES_CONFIG, type InvitesConfig, type InviteJoinRecord };

function resolveStorageDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps\\web") || cwd.endsWith("apps/web")) {
    return path.resolve(cwd, "..", "..", "storage");
  }
  return path.resolve(cwd, "storage");
}

export async function readStoredInvites(
  tenantId: string,
  guildId: string,
): Promise<InvitesConfig> {
  try {
    const storageDir = resolveStorageDir();
    const filePath = path.join(storageDir, "tenants", tenantId, "guilds", guildId, "invites.json");
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<InvitesConfig>;

    return {
      enabled: parsed.enabled ?? DEFAULT_INVITES_CONFIG.enabled,
      channelId: parsed.channelId ?? DEFAULT_INVITES_CONFIG.channelId,
      channelName: parsed.channelName ?? DEFAULT_INVITES_CONFIG.channelName,
      trackVanity: parsed.trackVanity ?? DEFAULT_INVITES_CONFIG.trackVanity,
      trackBots: parsed.trackBots ?? DEFAULT_INVITES_CONFIG.trackBots,
      protectFakes: parsed.protectFakes ?? DEFAULT_INVITES_CONFIG.protectFakes,
      fakeAccountAgeDays: parsed.fakeAccountAgeDays ?? DEFAULT_INVITES_CONFIG.fakeAccountAgeDays,
      joinMessage: parsed.joinMessage ?? DEFAULT_INVITES_CONFIG.joinMessage,
      leaveMessage: parsed.leaveMessage ?? DEFAULT_INVITES_CONFIG.leaveMessage,
      fakeJoinMessage: parsed.fakeJoinMessage ?? DEFAULT_INVITES_CONFIG.fakeJoinMessage,
      unknownJoinMessage: parsed.unknownJoinMessage ?? DEFAULT_INVITES_CONFIG.unknownJoinMessage,
      recentJoins: Array.isArray(parsed.recentJoins) ? parsed.recentJoins : [],
    };
  } catch {
    return { ...DEFAULT_INVITES_CONFIG };
  }
}

export async function writeStoredInvites(
  tenantId: string,
  guildId: string,
  data: InvitesConfig,
): Promise<InvitesConfig> {
  const storageDir = resolveStorageDir();
  const dirPath = path.join(storageDir, "tenants", tenantId, "guilds", guildId);
  const filePath = path.join(dirPath, "invites.json");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return data;
}

export async function appendStoredInviteJoin(
  tenantId: string,
  guildId: string,
  record: InviteJoinRecord,
): Promise<void> {
  const current = await readStoredInvites(tenantId, guildId);
  const updatedJoins = [record, ...(current.recentJoins || [])].slice(0, 50);
  await writeStoredInvites(tenantId, guildId, {
    ...current,
    recentJoins: updatedJoins,
  });
}
