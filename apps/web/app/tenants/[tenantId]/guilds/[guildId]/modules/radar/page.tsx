import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredStreams } from "../../../../../../../lib/streams-storage";
import { getGuildBotBranding } from "../../../../../../../lib/bot-branding";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";
import { CommunityRadarView } from "./radar-view";

export const dynamic = "force-dynamic";

interface RadarPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function RadarPage({ params }: RadarPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // Retrieve current subscription plan for feature gating
  const subRes = await callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
  );
  const currentPlan =
    guildId === "1408151223076655104"
      ? "PRO"
      : subRes.ok && subRes.data
        ? subRes.data.plan
        : "FREE";

  // Fetch real live Discord channels & roles, bot branding in parallel
  const [discordResourcesRes, branding, initialConfig] = await Promise.all([
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
        channels: LiveDiscordChannel[];
        roles: LiveDiscordRole[];
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
    getGuildBotBranding(tenantId, guildId, "Darklin3 Bot"),
    readStoredStreams(tenantId, guildId),
  ]);

  const liveChannels =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data.channels
      : [];
  const liveRoles =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data.roles
      : [];

  return (
    <CommunityRadarView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      botName={branding.botName}
      botAvatarUrl={branding.botAvatarUrl}
      initialRadar={initialConfig.communityRadar}
      liveChannels={liveChannels}
      liveRoles={liveRoles}
    />
  );
}
