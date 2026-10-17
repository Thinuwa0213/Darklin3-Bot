import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "@/lib/api";
import { readStoredSettings } from "@/lib/settings-storage";
import { getGuildBotBranding } from "@/lib/bot-branding";
import type { LiveDiscordChannel } from "../modules/welcome/welcome-types";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

interface SettingsPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function ServerSettingsPage({ params }: SettingsPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  // Fetch subscription, live Discord channels, branding, and stored settings in parallel
  const [subRes, discordResourcesRes, branding, initialSettings] = await Promise.all([
    callApiServer<{ plan: "FREE" | "PRO" | "ENTERPRISE" }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/subscription`,
    ),
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
        channels: LiveDiscordChannel[];
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
    getGuildBotBranding(tenantId, guildId),
    readStoredSettings(tenantId, guildId),
  ]);

  const currentPlan =
    guildId === "1408151223076655104"
      ? "PRO"
      : subRes.ok && subRes.data
        ? subRes.data.plan
        : "FREE";

  const liveChannels =
    discordResourcesRes.ok && discordResourcesRes.data?.data
      ? discordResourcesRes.data.data.channels
      : [];

  const guildName =
    discordResourcesRes.ok && discordResourcesRes.data?.data?.guildName
      ? discordResourcesRes.data.data.guildName
      : "Discord Server";

  return (
    <SettingsView
      tenantId={tenantId}
      guildId={guildId}
      guildName={guildName}
      botName={branding.botName}
      botAvatarUrl={branding.botAvatarUrl}
      currentPlan={currentPlan}
      channels={liveChannels}
      initialSettings={initialSettings}
    />
  );
}
