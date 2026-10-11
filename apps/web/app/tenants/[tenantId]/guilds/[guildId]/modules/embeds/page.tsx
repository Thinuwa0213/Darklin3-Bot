import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../../lib/api";
import { readStoredSettings } from "../../../../../../../lib/settings-storage";
import { EmbedsView } from "./embeds-view";

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
  const currentPlan =
    guildId === "1408151223076655104"
      ? "PRO"
      : subRes.ok && subRes.data
        ? subRes.data.plan
        : "FREE";

  const globalSettings = await readStoredSettings(tenantId, guildId);

  return (
    <EmbedsView
      tenantId={tenantId}
      guildId={guildId}
      currentPlan={currentPlan}
      globalSettings={globalSettings}
    />
  );
}
