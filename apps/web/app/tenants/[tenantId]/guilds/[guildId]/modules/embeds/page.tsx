import { redirect } from "next/navigation";
import { getServerSession } from "../../../../../../../lib/api";

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
  // Deferred to Update 2 - redirect safely to guild overview
  redirect(`/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}`);
}
