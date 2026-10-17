import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "@/lib/api";
import { BillingView, type BillingPricingPlan } from "../../../billing/billing-view";

export const dynamic = "force-dynamic";

interface GuildBillingPageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  "http://localhost:3002";

async function fetchAdminPricingPlans(): Promise<BillingPricingPlan[]> {
  try {
    const res = await fetch(`${ADMIN_API_URL}/api/pricing`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live pricing plans from Admin API:", err);
  }
  return [];
}

export default async function GuildBillingPage({ params }: GuildBillingPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  const [res, livePlans, discordResourcesRes] = await Promise.all([
    callApiServer<{
      plan: "FREE" | "PRO" | "ENTERPRISE";
      subscription: {
        id?: string;
        status?: string;
        currentPeriodEnd?: string | null;
        cancelAtPeriodEnd?: boolean;
      } | null;
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/subscription`),
    fetchAdminPricingPlans(),
    callApiServer<{
      ok: boolean;
      data: {
        guildName: string;
      };
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/discord-resources`),
  ]);

  const currentPlan = res.ok && res.data ? res.data.plan : "FREE";
  const subscription = res.ok && res.data ? res.data.subscription : null;
  const guildName =
    discordResourcesRes.ok && discordResourcesRes.data?.data?.guildName
      ? discordResourcesRes.data.data.guildName
      : undefined;

  return (
    <BillingView
      tenantId={tenantId}
      guildId={guildId}
      guildName={guildName}
      currentPlan={currentPlan}
      subscription={subscription}
      plans={livePlans}
    />
  );
}
