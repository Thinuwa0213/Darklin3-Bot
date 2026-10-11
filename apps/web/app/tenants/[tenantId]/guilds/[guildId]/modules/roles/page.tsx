import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredRolePanels } from "../../../../../../../lib/roles-storage";
import type {
  LiveDiscordChannel,
  LiveDiscordRole,
  LiveDiscordEmoji,
} from "../welcome/welcome-types";
import { RolesView } from "./roles-view";

export const dynamic = "force-dynamic";

interface RolesPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function RolesPage({ params }: RolesPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // 1. Fetch Plan
  const subRes = await callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
  );
  const currentPlan = subRes.ok && subRes.data ? subRes.data.plan : "FREE";

  // 2. Fetch live Discord channels & roles & emojis
  const discordResourcesRes = await callApiServer<{
    ok: boolean;
    data: {
      guildName: string;
      channels: LiveDiscordChannel[];
      roles: LiveDiscordRole[];
      emojis?: LiveDiscordEmoji[];
    };
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`);

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data
      : { guildName: "Discord Server", channels: [], roles: [], emojis: [] };

  // 3. Fetch Bot Branding for realistic preview
  const brandingRes = await callApiServer<{
    botName: string;
    discordAvatarUrl: string | null;
    customAvatarUrl: string | null;
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding`);

  const botName =
    brandingRes.ok && brandingRes.data?.botName ? brandingRes.data.botName : "Darklin3 Bot";
  const botAvatarUrl =
    brandingRes.ok && brandingRes.data
      ? brandingRes.data.customAvatarUrl ?? brandingRes.data.discordAvatarUrl ?? null
      : null;

  // 4. Load stored panels
  const initialConfig = await readStoredRolePanels(tenantId, guildId);

  return (
    <RolesView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      channels={liveResources.channels}
      roles={liveResources.roles}
      emojis={liveResources.emojis ?? []}
      botName={botName}
      botAvatarUrl={botAvatarUrl}
      initialConfig={initialConfig}
    />
  );
}
