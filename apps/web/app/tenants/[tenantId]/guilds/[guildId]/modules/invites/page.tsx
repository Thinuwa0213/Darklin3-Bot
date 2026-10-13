import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredInvites } from "../../../../../../../lib/invites-storage";
import { getGuildBotBranding } from "../../../../../../../lib/bot-branding";
import { InvitesView } from "./invites-view";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";

export const dynamic = "force-dynamic";

interface InvitesPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function InvitesPage({ params }: InvitesPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // 1. Retrieve current subscription plan for feature gating
  const subRes = await callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
  );
  const currentPlan =
    guildId === "1408151223076655104"
      ? "PRO"
      : subRes.ok && subRes.data
        ? subRes.data.plan
        : "FREE";

  // 2. Fetch live Discord resources, bot branding, and stored config in parallel
  const [discordResourcesRes, branding, storedConfig, runtimeRes] = await Promise.all([
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
        channels: LiveDiscordChannel[];
        roles: LiveDiscordRole[];
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
    getGuildBotBranding(tenantId, guildId, "Darklin3 Bot"),
    readStoredInvites(tenantId, guildId),
    callApiServer<{
      status: string;
      botApplicationId: string | null;
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/runtime-status`),
  ]);

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data ? discordResourcesRes.data.data : null;

  const botRuntimeStatus = runtimeRes.ok && runtimeRes.data ? runtimeRes.data.status : "NOT_CONFIGURED";
  const isBotOnline = botRuntimeStatus === "ONLINE" || botRuntimeStatus === "ACTIVE_ASSIGNMENT";

  return (
    <InvitesView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      initialConfig={storedConfig}
      botName={branding.botName}
      botAvatarUrl={branding.botAvatarUrl}
      serverName={liveResources?.guildName || "Community Server"}
      liveChannels={liveResources?.channels ?? []}
      liveRoles={liveResources?.roles ?? []}
      botRuntimeStatus={botRuntimeStatus}
      isBotOnline={isBotOnline}
    />
  );
}
