import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredStreams } from "../../../../../../../lib/streams-storage";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";
import { NotificationsView } from "./notifications-view";

export const dynamic = "force-dynamic";

interface NotificationsPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
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

  // Fetch real live Discord channels & roles
  const discordResourcesRes = await callApiServer<{
    ok: boolean;
    data: {
      guildName: string;
      channels: LiveDiscordChannel[];
      roles: LiveDiscordRole[];
    };
  }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`);

  const liveChannels =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data.channels
      : [];
  const liveRoles =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data.roles
      : [];

  // Read stored streams configuration
  const initialConfig = await readStoredStreams(tenantId, guildId);

  return (
    <NotificationsView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      initialConfig={initialConfig}
      liveChannels={liveChannels}
      liveRoles={liveRoles}
    />
  );
}
