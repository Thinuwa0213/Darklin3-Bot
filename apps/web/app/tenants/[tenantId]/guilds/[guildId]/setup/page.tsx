import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../../lib/api";
import { BotSetupForm } from "../../../../../components/bot-setup-form";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function BotSetupPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  const res = await callApiServer<{
    status:
      | "NOT_CONFIGURED"
      | "PENDING_CREDENTIAL"
      | "UNASSIGNED"
      | "ACTIVE_ASSIGNMENT"
      | "ONLINE"
      | "DEGRADED"
      | "OFFLINE";
    botApplicationId: string | null;
    botName?: string | null;
  }>(
    `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/runtime-status`,
  );

  const initialStatus = res.ok && res.data ? res.data.status : "NOT_CONFIGURED";
  const botApplicationId = res.ok && res.data ? res.data.botApplicationId : null;
  const currentBotName = res.ok && res.data ? res.data.botName : null;

  return (
    <div className="space-y-6">
      <PageHeader
        category="Discord Bot Instance"
        title="Bot Configuration"
        description="Configure your Discord bot application token and credentials."
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
      />

      <div className="py-2">
        <BotSetupForm
          tenantId={tenantId}
          guildId={guildId}
          initialStatus={initialStatus}
          botApplicationId={botApplicationId}
          currentBotName={currentBotName}
        />
      </div>
    </div>
  );
}
