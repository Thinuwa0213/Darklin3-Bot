import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredWelcome } from "../../../../../../../lib/welcome-storage";
import { WelcomeView } from "./welcome-view";
import type { LiveDiscordChannel, LiveDiscordRole } from "./welcome-types";

export const dynamic = "force-dynamic";

interface WelcomePageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function WelcomePage({ params }: WelcomePageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // Fetch all necessary data in parallel to eliminate waterfall latency
  const [subRes, brandingRes, discordResourcesRes, storedConfig, runtimeRes] = await Promise.all([
    callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
    ),
    callApiServer<{
      botName: string;
      discordAvatarUrl: string | null;
      customAvatarUrl: string | null;
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding`),
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
        channels: LiveDiscordChannel[];
        roles: LiveDiscordRole[];
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
    readStoredWelcome(tenantId, guildId),
    callApiServer<{
      status: string;
      botApplicationId: string | null;
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/runtime-status`),
  ]);

  const currentPlan =
    guildId === "1408151223076655104"
      ? "PRO"
      : subRes.ok && subRes.data
        ? subRes.data.plan
        : "FREE";

  const botName = brandingRes.ok && brandingRes.data?.botName ? brandingRes.data.botName : "CreatorBot";
  const botAvatarUrl =
    brandingRes.ok && brandingRes.data
      ? brandingRes.data.customAvatarUrl ?? brandingRes.data.discordAvatarUrl ?? null
      : null;

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data ? discordResourcesRes.data.data : null;

  const botRuntimeStatus = runtimeRes.ok && runtimeRes.data ? runtimeRes.data.status : "NOT_CONFIGURED";
  const isBotOnline = botRuntimeStatus === "ONLINE" || botRuntimeStatus === "ACTIVE_ASSIGNMENT";

  return (
    <WelcomeView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      initialConfig={storedConfig}
      botName={botName}
      botAvatarUrl={botAvatarUrl}
      serverName={liveResources?.guildName || "Creator Realm"}
      liveChannels={liveResources?.channels ?? []}
      liveRoles={liveResources?.roles ?? []}
      botRuntimeStatus={botRuntimeStatus}
      isBotOnline={isBotOnline}
    />
  );
}
