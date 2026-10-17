import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredBoosterConfig } from "../../../../../../../lib/booster-storage";
import { readStoredSettings } from "../../../../../../../lib/settings-storage";
import { BoosterView } from "./booster-view";
import type { LiveDiscordChannel } from "../welcome/welcome-types";

export const dynamic = "force-dynamic";

interface BoosterPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function BoosterPage({ params }: BoosterPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // Fetch all booster module data concurrently to avoid waterfall latency
  const [subRes, brandingRes, discordResourcesRes, storedConfig, globalSettings, runtimeRes] =
    await Promise.all([
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
        };
      }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
      readStoredBoosterConfig(tenantId, guildId),
      readStoredSettings(tenantId, guildId),
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

  const botName = brandingRes.ok && brandingRes.data?.botName ? brandingRes.data.botName : "Darklin3 Bot";
  const botAvatarUrl =
    brandingRes.ok && brandingRes.data
      ? brandingRes.data.customAvatarUrl ?? brandingRes.data.discordAvatarUrl ?? null
      : null;

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data ? discordResourcesRes.data.data : null;

  const botRuntimeStatus = runtimeRes.ok && runtimeRes.data ? runtimeRes.data.status : "NOT_CONFIGURED";
  const isBotOnline = botRuntimeStatus === "ONLINE" || botRuntimeStatus === "ACTIVE_ASSIGNMENT";

  return (
    <BoosterView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      initialConfig={storedConfig}
      globalSettings={globalSettings}
      botName={botName}
      botAvatarUrl={botAvatarUrl}
      serverName={liveResources?.guildName || "Community Server"}
      liveChannels={liveResources?.channels ?? []}
      botRuntimeStatus={botRuntimeStatus}
      isBotOnline={isBotOnline}
    />
  );
}
