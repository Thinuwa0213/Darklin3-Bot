import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredModerationConfig } from "../../../../../../../lib/moderation-storage";
import { ModerationView } from "./moderation-view";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";

export const dynamic = "force-dynamic";

interface ModerationPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function ModerationPage({ params }: ModerationPageProps) {
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

  // 3. Load persistent moderation configuration
  const storedConfig = await readStoredModerationConfig(tenantId, guildId);

  return (
    <ModerationView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      initialConfig={storedConfig}
      serverName={liveResources?.guildName || "Community Server"}
      liveChannels={liveResources?.channels ?? []}
      liveRoles={liveResources?.roles ?? []}
    />
  );
}
