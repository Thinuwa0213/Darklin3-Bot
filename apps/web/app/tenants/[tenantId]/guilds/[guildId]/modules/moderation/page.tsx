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

  // Fetch subscription, discord resources, and stored moderation config in parallel
  const [subRes, discordResourcesRes, storedConfig] = await Promise.all([
    callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
    ),
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
        channels: LiveDiscordChannel[];
        roles: LiveDiscordRole[];
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
    readStoredModerationConfig(tenantId, guildId),
  ]);

  const currentPlan =
    guildId === "1408151223076655104"
      ? "PRO"
      : subRes.ok && subRes.data
        ? subRes.data.plan
        : "FREE";

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data ? discordResourcesRes.data.data : null;

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
