import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredSettings } from "../../../../../../../lib/settings-storage";
import { EmbedsView } from "./embeds-view";
import type { LiveDiscordChannel } from "../welcome/welcome-types";

export const dynamic = "force-dynamic";

interface EmbedsPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function EmbedsPage({ params }: EmbedsPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  const subRes = await callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
  );
  const currentPlan = subRes.ok && subRes.data ? subRes.data.plan : "FREE";

  const globalSettings = await readStoredSettings(tenantId, guildId);

  const discordResourcesRes = await callApiServer<{
    ok: boolean;
    data: {
      channels: LiveDiscordChannel[];
    };
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`);

  const liveChannels = discordResourcesRes.ok && discordResourcesRes.data?.data?.channels ? discordResourcesRes.data.data.channels : [];

  return (
    <EmbedsView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      globalSettings={globalSettings}
      liveChannels={liveChannels}
    />
  );
}
