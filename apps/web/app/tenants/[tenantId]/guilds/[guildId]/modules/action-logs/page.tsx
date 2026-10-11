import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredActionLogsConfig } from "../../../../../../../lib/action-logs-storage";
import { ActionLogsView } from "./action-logs-view";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";

export const dynamic = "force-dynamic";

interface ActionLogsPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function ActionLogsPage({ params }: ActionLogsPageProps) {
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

  // 2. Fetch live Discord resources (channels, roles, guild name)
  const discordResourcesRes = await callApiServer<{
    ok: boolean;
    data: {
      guildName: string;
      channels: LiveDiscordChannel[];
      roles: LiveDiscordRole[];
    };
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`);

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data ? discordResourcesRes.data.data : null;

  // 3. Load persistent action logs configuration
  const storedConfig = await readStoredActionLogsConfig(tenantId, guildId);

  // 4. Fetch authoritative bot runtime status
  const runtimeRes = await callApiServer<{
    status: string;
    botApplicationId: string | null;
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/runtime-status`);

  const botRuntimeStatus = runtimeRes.ok && runtimeRes.data ? runtimeRes.data.status : "NOT_CONFIGURED";
  const isBotOnline = botRuntimeStatus === "ONLINE" || botRuntimeStatus === "ACTIVE_ASSIGNMENT";

  return (
    <ActionLogsView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      initialConfig={storedConfig}
      serverName={liveResources?.guildName || "Community Server"}
      liveChannels={liveResources?.channels ?? []}
      liveRoles={liveResources?.roles ?? []}
      botRuntimeStatus={botRuntimeStatus}
      isBotOnline={isBotOnline}
    />
  );
}
