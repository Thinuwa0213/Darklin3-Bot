import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredRolePanels } from "../../../../../../../lib/roles-storage";
import type {
  LiveDiscordChannel,
  LiveDiscordRole,
  LiveDiscordEmoji,
} from "../welcome/welcome-types";
import { RolesView } from "./roles-view";

export const dynamic = "force-dynamic";

interface RolesPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function RolesPage({ params }: RolesPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // Parallelize fetches to eliminate sequential waterfall delays
  const [subRes, discordResourcesRes, brandingRes, initialConfig] = await Promise.all([
    callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
    ),
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
        channels: LiveDiscordChannel[];
        roles: LiveDiscordRole[];
        emojis?: LiveDiscordEmoji[];
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
    callApiServer<{
      botName: string;
      discordAvatarUrl: string | null;
      customAvatarUrl: string | null;
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding`),
    readStoredRolePanels(tenantId, guildId),
  ]);

  const currentPlan = subRes.ok && subRes.data ? subRes.data.plan : "FREE";

  const liveResources =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data
      : { guildName: "Discord Server", channels: [], roles: [], emojis: [] };

  const botName =
    brandingRes.ok && brandingRes.data?.botName ? brandingRes.data.botName : "Darklin3 Bot";
  const botAvatarUrl =
    brandingRes.ok && brandingRes.data
      ? brandingRes.data.customAvatarUrl ?? brandingRes.data.discordAvatarUrl ?? null
      : null;

  return (
    <RolesView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      channels={liveResources.channels}
      roles={liveResources.roles}
      emojis={liveResources.emojis ?? []}
      botName={botName}
      botAvatarUrl={botAvatarUrl}
      initialConfig={initialConfig}
    />
  );
}
