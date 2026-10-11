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

  // 2. Load bot branding for the live preview mockup
  const brandingRes = await callApiServer<{
    botName: string;
    discordAvatarUrl: string | null;
    customAvatarUrl: string | null;
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding`);

  const botName = brandingRes.ok && brandingRes.data?.botName ? brandingRes.data.botName : "Darklin3 Bot";
  const botAvatarUrl =
    brandingRes.ok && brandingRes.data
      ? brandingRes.data.customAvatarUrl ?? brandingRes.data.discordAvatarUrl ?? null
      : null;

  // 3. Fetch real live Discord resources (channels, guild name)
  const discordResourcesRes = await callApiServer<{
    ok: boolean;
    data: {
      guildName: string;
      channels: LiveDiscordChannel[];
    };
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`);

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data ? discordResourcesRes.data.data : null;

  // 4. Load persistent booster configuration and guild branding settings
  const [storedConfig, globalSettings] = await Promise.all([
    readStoredBoosterConfig(tenantId, guildId),
    readStoredSettings(tenantId, guildId),
  ]);

  // 5. Fetch authoritative bot runtime status
  const runtimeRes = await callApiServer<{
    status: string;
    botApplicationId: string | null;
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/runtime-status`);

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
